// internal/session/session.go
package session

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"sync"
	"time"
)

// Update the Session struct to include a values map
type Session struct {
	ID       string
	Username string
	Created  time.Time
	Values   map[string]interface{} // Add this field to store arbitrary values
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

// IsUserLoggedIn checks if the user has a valid active session
func IsUserLoggedIn(r *http.Request) bool {
	// Check for session cookie
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return false
	}

	// Verify session exists and is valid
	manager.mu.RLock()
	defer manager.mu.RUnlock()

	session, exists := manager.sessions[cookie.Value]
	if !exists {
		return false
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
func SetValue(r *http.Request, key string, value interface{}) bool {
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

// Update SetSessionUser to initialize the Values map
func SetSessionUser(w http.ResponseWriter, username string) {
	sessionID := generateSessionID()

	manager.mu.Lock()
	manager.sessions[sessionID] = &Session{
		ID:       sessionID,
		Username: username,
		Created:  time.Now(),
		Values:   make(map[string]interface{}), // Initialize the values map
	}
	manager.mu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
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

// Initialize session cleanup
func init() {
	// Run cleanup every 15 minutes
	go func() {
		for {
			time.Sleep(15 * time.Minute)
			CleanupSessions()
		}
	}()
}
