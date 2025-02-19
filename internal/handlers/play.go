// internal/handlers/play.go
package handlers

import (
	"net/http"
)

func PlayHandler(w http.ResponseWriter, r *http.Request) {
	// Serve the static play page
	http.ServeFile(w, r, "static/play.html")
}
