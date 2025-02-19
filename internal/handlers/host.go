// internal/handlers/join.go
package handlers

import (
	"net/http"

	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/logger"
)

func HostHandler(w http.ResponseWriter, r *http.Request) {
	// only allow admins into host
	player := game.GetMe(r)
	// IF this user is the host then assign admin rights
	if player.IsAdmin {
		logger.Info("player is admin")
		http.ServeFile(w, r, "static/host.html")
	} else {
		logger.Info("player is not admin")
		http.Redirect(w, r, "/play", http.StatusSeeOther)
		// amazonq-ignore-next-line
	}
}
