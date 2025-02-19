// internal/handlers/join.go
package handlers

import (
	"net/http"

	"github.com/richard-senior/1pcc/internal/config"
	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/session"
)

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
		gameInstance.AddPlayer(username)
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
