// internal/handlers/join.go
package handlers

import (
	"net/http"

	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/session"
)

func JoinHandler(w http.ResponseWriter, r *http.Request) {
	// Check if user is already logged in
	if _, ok := session.GetSessionUser(r); ok {
		http.Redirect(w, r, "/play", http.StatusSeeOther)
		return
	}

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
		gameInstance.AddPlayer(username)

		http.Redirect(w, r, "/play", http.StatusSeeOther)
		return
	}

	// Serve the static join page
	http.ServeFile(w, r, "static/join.html")
}
