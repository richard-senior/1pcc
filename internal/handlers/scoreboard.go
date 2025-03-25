// internal/handlers/scoreboard.go
package handlers

import (
	"net/http"
)

func ScoreboardHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "static/scoreboard.html")
}
