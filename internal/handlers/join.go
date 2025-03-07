// internal/handlers/join.go
package handlers

import (
	"net/http"

	"github.com/richard-senior/1pcc/internal/logger"
	"github.com/richard-senior/1pcc/internal/session"
)

func JoinHandler(w http.ResponseWriter, r *http.Request) {
	ip := session.GetIPAddress(r)
	if r.Method == "POST" {
		username := r.FormValue("username")
		if username == "" {
			logger.Info("Empty username submitted from IP: %s", session.GetIPAddress(r))
			http.Error(w, "Username is required", http.StatusBadRequest)
			return
		}
		session.AddPlayer(w, r, username, ip)
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
