// internal/handlers/join.go
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/richard-senior/1pcc/internal/session"
)

type RegisterResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func JoinHandler(w http.ResponseWriter, r *http.Request) {
	// is this user banned for starters?
	if session.IsBanned("", r) {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	ip := session.GetIPAddress(r)
	if r.Method == "POST" {
		w.Header().Set("Content-Type", "application/json")
		response := RegisterResponse{
			Success: true,
			Message: "Logged In",
		}
		username := r.FormValue("username")
		if username == "" {
			response.Message = "Username is required"
			response.Success = false
			json.NewEncoder(w).Encode(response)
			return
		}
		username = strings.ToLower(username)
		// don't allow people to log in as the same user
		if session.UserExists(username) {
			response.Message = "Username already taken, please choose another"
			response.Success = false
			json.NewEncoder(w).Encode(response)
			return
		}
		session.AddPlayer(w, r, username, ip)
		json.NewEncoder(w).Encode(response)
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
