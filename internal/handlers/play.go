// internal/handlers/play.go
package handlers

import (
	"net/http"

	"github.com/richard-senior/1pcc/internal/session"
)

func PlayHandler(w http.ResponseWriter, r *http.Request) {
	// Check if user is logged in
	if _, ok := session.GetSessionUser(r); !ok {
		http.Redirect(w, r, "/join", http.StatusSeeOther)
		return
	}

	// Serve the static play page
	http.ServeFile(w, r, "static/play.html")
}
