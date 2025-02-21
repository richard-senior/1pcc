// internal/handlers/observe.go
package handlers

import (
	"net/http"
)

func ObserveHandler(w http.ResponseWriter, r *http.Request) {
	// Serve the static play page
	http.ServeFile(w, r, "static/observe.html")
}
