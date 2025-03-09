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
	Ejected  bool
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

func GetSession(username string) *Session {
	for _, session := range manager.sessions {
		if session.Username == username {
			return session
		}
	}
	return nil
}

/** Fascism methods */
func EjectByUsername(username string) {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	for _, session := range manager.sessions {
		if session.Username == username {
			session.Ejected = true
			gameInstance := game.GetGame()
			gameInstance.RemovePlayer(session.Username)
		}
	}

	// Now remove from people
}

// IsEjected checks if a user has preiously been ejected from the game
func IsEjected(username string) bool {
	manager.mu.RLock()
	defer manager.mu.RUnlock()
	// Check any session for this username to see if they're banned
	for _, session := range manager.sessions {
		if session.Username == username {
			return session.Banned
		}
	}
	return false
}

// Ban sets the banned flag for a user and ejects them
func Ban(username string) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	// Find all sessions for this username, set banned flag and remove them
	for _, session := range manager.sessions {
		if session.Username == username {
			session.Banned = true
			gameInstance := game.GetGame()
			gameInstance.RemovePlayer(session.Username)
		}
	}
}

// IsBanned checks if a user is banned
func IsBanned(username string, ip string) bool {
	manager.mu.RLock()
	defer manager.mu.RUnlock()
	// Check any session for this username to see if they're banned
	for _, session := range manager.sessions {
		if len(username) > 0 && session.Username == username {
			return session.Banned
		}
		if len(ip) > 0 && session.IP == ip {
			return session.Banned
		}
	}
	return false
}

// IsUserLoggedIn checks if the user has a valid active session
// Modified IsUserLoggedIn to check for banned status
func IsUserLoggedIn(w http.ResponseWriter, r *http.Request) bool {
	// is this IP listed as banned?
	ip := GetIPAddress(r)
	if IsBanned("", ip) {
		return false
	}

	// Check for session cookie
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return false
	}

	manager.mu.RLock()
	defer manager.mu.RUnlock()

	session, exists := manager.sessions[cookie.Value]
	if !exists {
		return false
	}

	// Check if user is banned if their session is still stored
	if session.Banned {
		return false
	}

	// if we ejected a player let them back in now and re-add them to the
	// players list in Game. This will zero their score
	if session.Ejected {
		session.Ejected = false
		AddPlayer(w, r, session.Username, ip)
	}

	// Check if session has expired
	if time.Since(session.Created) > time.Hour {
		// Clean up expired session
		go func() {
			manager.mu.Lock()
			delete(manager.sessions, cookie.Value)
			manager.mu.Unlock()
		}()
		return false
	}

	return true
}

// SetValue stores a value in the session
func SetValue(r *http.Request, key string, value any) bool {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return false
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()

	if session, exists := manager.sessions[cookie.Value]; exists {
		if session.Values == nil {
			session.Values = make(map[string]interface{})
		}
		session.Values[key] = value
		return true
	}
	return false
}

// GetValue retrieves a value from the session
func GetValue(r *http.Request, key string) (interface{}, bool) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return nil, false
	}

	manager.mu.RLock()
	defer manager.mu.RUnlock()

	if session, exists := manager.sessions[cookie.Value]; exists {
		if session.Values == nil {
			return nil, false
		}
		value, ok := session.Values[key]
		return value, ok
	}
	return nil, false
}

// GetAllValues retrieves all values from the session
func GetAllValues(r *http.Request) (map[string]interface{}, bool) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return nil, false
	}

	manager.mu.RLock()
	defer manager.mu.RUnlock()

	if session, exists := manager.sessions[cookie.Value]; exists {
		if session.Values == nil {
			return make(map[string]interface{}), true
		}
		return session.Values, true
	}
	return nil, false
}

// RemoveValue removes a value from the session
func RemoveValue(r *http.Request, key string) bool {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return false
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()

	if session, exists := manager.sessions[cookie.Value]; exists {
		if session.Values != nil {
			delete(session.Values, key)
			return true
		}
	}
	return false
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
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return "", false
	}

	manager.mu.RLock()
	defer manager.mu.RUnlock()

	if session, exists := manager.sessions[cookie.Value]; exists {
		return session.Username, true
	}
	return "", false
}

func UserExists(username string) bool {
	manager.mu.RLock()
	defer manager.mu.RUnlock()
	if username == "" {
		return false
	}
	for _, session := range manager.sessions {
		if session.Username == username {
			return true
		}
	}
	return false
}

func SetSessionUser(w http.ResponseWriter, username string, ip string) {

	// if the player has been kicked then let them back in
	sessionID := generateSessionID()
	// do we have a player with this username already?
	s := GetSession(username)
	if s != nil && s.ID != "" {
		sessionID = s.ID // Changed from sessionId to sessionID
	}

	logger.Info("Creating new session for user.", username, sessionID)

	manager.mu.Lock()
	manager.sessions[sessionID] = &Session{
		ID:       sessionID,
		Username: username,
		Banned:   false,
		IP:       ip,
		Created:  time.Now(),
		Values:   make(map[string]interface{}), // Initialize the values map
	}
	manager.mu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,                // Change to false for local development
		SameSite: http.SameSiteLaxMode, // Less restrictive than Strict
		MaxAge:   3600,
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
	// Create session and set cookie
	SetSessionUser(w, username, ip)
	// Add player to game
	gameInstance := game.GetGame()
	hun := config.GetHostUsername()
	// IF this user is the host then assign admin and observer rights
	if hun == username {
		gameInstance.AddPlayer(username, true, true, ip)
		// amazonq-ignore-next-line
		http.Redirect(w, r, "/host", http.StatusSeeOther)
	} else {
		gameInstance.AddPlayer(username, false, false, ip)
		// amazonq-ignore-next-line
		http.Redirect(w, r, "/play", http.StatusSeeOther)
	}
}

// CleanupSessions removes expired sessions (call this periodically)
func CleanupSessions() {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	expiry := time.Now().Add(-1 * time.Hour)
	for id, session := range manager.sessions {
		if session.Created.Before(expiry) {
			delete(manager.sessions, id)
		}
	}
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
