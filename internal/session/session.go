// internal/session/session.go
package session

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/richard-senior/1pcc/internal/config"
	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/logger"
)

// Update the Session struct to include a values map
type Session struct {
	ID       string
	Username string
	IP       string
	Browser  string
	Banned   bool
	Created  time.Time
	Values   map[string]any // Add this field to store arbitrary values
}

type SessionManager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
}

var (
	manager = &SessionManager{
		sessions: make(map[string]*Session),
	}
	cookieName = "1pcc"
)

func GetSession(username string, r *http.Request) *Session {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	// First try to find session by cookie
	if r != nil {
		if cookie, err := r.Cookie(cookieName); err == nil {
			if session, exists := manager.sessions[cookie.Value]; exists {
				if !session.Banned {
					return session
				}
			}
		}
	}

	// Then try by username if provided
	if username != "" {
		for _, session := range manager.sessions {
			if session.Username == username && !session.Banned {
				return session
			}
		}
	}

	// Only use IP matching if not in testing mode
	if !config.GetTestingMode() {
		ip := GetIPAddress(r)
		for _, session := range manager.sessions {
			if session.IP == ip && !session.Banned {
				return session
			}
		}
	}

	return nil
}

/** Fascism methods */
func EjectByUsername(username string) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	key := ""
	for k, session := range manager.sessions {
		if session.Username == username {
			key = k
			// Now remove from game
			gameInstance := game.GetGame()
			gameInstance.RemovePlayer(session.Username)
		}
	}
	// also delete from session, they'll have to log in again
	if key != "" {
		delete(manager.sessions, key)
	}
}

// Ban sets the banned flag for a user and ejects them
func Ban(username string) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	// Find all sessions for this username, set banned flag and remove them
	// we leave their session in place so that they can't recreate one
	// and we can continue to see their banned flag
	for _, session := range manager.sessions {
		if session.Username == username {
			session.Banned = true
			gameInstance := game.GetGame()
			gameInstance.RemovePlayer(session.Username)
		}
	}
}

// IsBanned checks if a user is banned
func IsBanned(username string, r *http.Request) bool {
	// Get the IP address of the user
	ip := GetIPAddress(r)
	cookie, err := r.Cookie(cookieName)
	if err == nil && cookie != nil && cookie.Value != "" {
		s, exists := manager.sessions[cookie.Value]
		if exists && s != nil {
			return s.Banned
		}
	}
	// Check any session for this username to see if they're banned
	for _, session := range manager.sessions {
		if username != "" && session.Username == username {
			return session.Banned
		}
		if ip != "" && session.IP == ip {
			return session.Banned
		}
	}
	return false
}

// IsUserLoggedIn checks if the user has a valid active session
// Modified IsUserLoggedIn to check for banned status
func IsUserLoggedIn(w http.ResponseWriter, r *http.Request) bool {
	s := GetSession("", r)
	if s != nil {
		return true
	}
	return false
}

// SetValue stores a value in the session
func SetValue(r *http.Request, key string, value any) bool {
	s := GetSession("", r)
	if s == nil {
		return false
	}
	manager.mu.Lock()
	defer manager.mu.Unlock()
	if s.Values == nil {
		s.Values = make(map[string]interface{})
	}
	s.Values[key] = value
	return true
}

// GetValue retrieves a value from the session
func GetValue(r *http.Request, key string) (any, bool) {
	s := GetSession("", r)
	if s == nil || s.Values == nil {
		return nil, false
	}
	value, ok := s.Values[key]
	return value, ok
}

// GetAllValues retrieves all values from the session
// TODO convert this to use GetSession
func GetAllValues(r *http.Request) (map[string]any, bool) {
	s := GetSession("", r)
	if s == nil || s.Values == nil {
		return nil, false
	}
	return s.Values, true
}

// RemoveValue removes a value from the session
func RemoveValue(r *http.Request, key string) bool {
	s := GetSession("", r)
	if s == nil || s.Values == nil {
		return false
	}
	manager.mu.Lock()
	defer manager.mu.Unlock()
	delete(s.Values, key)
	return true
}

// generateSessionID creates a random session ID
func generateSessionID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func GetUsername(r *http.Request) string {
	if username, ok := GetSessionUser(r); ok {
		return username
	} else {
		return ""
	}
}

// GetSessionUser retrieves the username from the session
func GetSessionUser(r *http.Request) (string, bool) {
	s := GetSession("", r)
	if s != nil {
		return s.Username, true
	}
	return "", false
}

func UserExists(username string) bool {
	if username == "" {
		return false
	}
	s := GetSession(username, nil)
	if s == nil {
		return false
	}
	return true
}

func SetSessionUser(w http.ResponseWriter, r *http.Request, username string, ip string) {
	if username == "" || ip == "" {
		return
	}

	// un eject any ejected otherwise logged in players
	cookie, err := r.Cookie(cookieName)
	if err == nil && cookie != nil {
		s, exists := manager.sessions[cookie.Value]
		if exists && s != nil {
			s.Banned = false
			return
		}
	}
	sessionID := generateSessionID()
	logger.Info("Creating new session for user.", username, sessionID)

	manager.mu.Lock()
	manager.sessions[sessionID] = &Session{
		ID:       sessionID,
		Username: username,
		Browser:  GetBrowser(r),
		Banned:   false,
		IP:       ip,
		Created:  time.Now(),
		Values:   make(map[string]any), // Initialize the values map
	}
	manager.mu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Change to false for local development
		//SameSite: http.SameSiteLaxMode, // Less restrictive than Strict
		SameSite: http.SameSiteDefaultMode, // Less restrictive than Strict
		MaxAge:   3600,
		Domain:   "", // edge
	})
}

// ClearSession removes the session
func ClearSession(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err == nil {
		manager.mu.Lock()
		delete(manager.sessions, cookie.Value)
		manager.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}

func AddPlayer(w http.ResponseWriter, r *http.Request, username string, ip string) {
	isHost := false
	// lock to avoid race condition
	manager.mu.Lock()
	i := game.GetGame()
	if i.Players == nil || len(i.Players) < 1 {
		isHost = true
	}
	manager.mu.Unlock()

	if IsBanned(username, r) {
		// amazonq-ignore-next-line
		http.Redirect(w, r, "https://www.google.co.uk/", http.StatusSeeOther)
		return
	}

	// Create session and set cookie
	SetSessionUser(w, r, username, ip)
	// IF this user is the host then assign admin and observer rights
	gameInstance := game.GetGame()
	if isHost {
		gameInstance.AddPlayer(username, true, true, ip)
		// amazonq-ignore-next-line
		http.Redirect(w, r, "/host", http.StatusSeeOther)
	} else {
		gameInstance.AddPlayer(username, false, false, ip)
		// amazonq-ignore-next-line
		http.Redirect(w, r, "/play", http.StatusSeeOther)
	}
}

// Returns the name of the browser as gleaned from the request object
// can be used to determine if a client is the same client etc.
func GetBrowser(r *http.Request) string {
	userAgent := strings.ToLower(r.UserAgent())
	if strings.Contains(userAgent, "edg") {
		return "Edge"
	} else if strings.Contains(userAgent, "chrome") {
		return "Chrome"
	} else if strings.Contains(userAgent, "firefox") {
		return "Firefox"
	} else if strings.Contains(userAgent, "safari") {
		return "Safari"
	} else if strings.Contains(userAgent, "opera") {
		return "Opera"
	} else if strings.Contains(userAgent, "ie") || strings.Contains(userAgent, "trident") {
		return "IE"
	}
	return "Unknown"
}

// GetIPAddress extracts the real IP address from the request
func GetIPAddress(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxies)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		// Take the first IP if multiple are present
		ips := strings.Split(forwarded, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header next
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	// Strip port number if present
	remoteAddr := r.RemoteAddr
	if strings.Contains(remoteAddr, ":") {
		remoteAddr, _, _ = strings.Cut(remoteAddr, ":")
	}
	return remoteAddr
}

// this is kind of a 'static' function
// that is, we can access it from anywhere with just GetMe(r) etc.
func GetMe(r *http.Request) *game.Player {
	username := GetUsername(r)
	gs := game.GetGame()
	if player, exists := gs.Players[username]; exists {
		return player
	}
	return nil
}
