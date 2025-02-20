// internal/handlers/join.go
package handlers

import (
	"net/http"
	"strings"

	"github.com/richard-senior/1pcc/internal/config"
	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/session"
)

// getIPAddress extracts the real IP address from the request
func getIPAddress(r *http.Request) string {
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

func JoinHandler(w http.ResponseWriter, r *http.Request) {

	if r.Method == "POST" {
		username := r.FormValue("username")
		if username == "" {
			http.Error(w, "Username is required", http.StatusBadRequest)
			return
		}

		// Create session and set cookie
		session.SetSessionUser(w, username)

		// Add player to game
		gameInstance := game.GetGame()
		ip := getIPAddress(r)
		gameInstance.AddPlayer(username, false, false, ip)
		//username string, isAdmin bool, isObserver bool, ipAddress str
		hun := config.GetHostUsername()
		// IF this user is the host then assign admin rights
		if hun == username {
			gameInstance.SetPlayerAdmin(username)
			// amazonq-ignore-next-line
			http.Redirect(w, r, "/host", http.StatusSeeOther)
		} else {
			// amazonq-ignore-next-line
			http.Redirect(w, r, "/play", http.StatusSeeOther)
		}
		return
	}

	// get requests with a cookie will be dealt with by main.go
	if _, ok := session.GetSessionUser(r); ok {
		http.Redirect(w, r, "/play", http.StatusSeeOther)
		return
	}

	// Serve the static join page
	http.ServeFile(w, r, "static/join.html")

}
