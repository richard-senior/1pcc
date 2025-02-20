// handlers/api.go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/logger"
)

func HandleAPI(w http.ResponseWriter, r *http.Request) {
	// Set JSON content type
	w.Header().Set("Content-Type", "application/json")

	// Handle different API endpoints
	switch r.URL.Path {
	case "/api/game-state":
		handleGameState(w, r)
	case "/api/submit-answer":
		handleSubmitAnswer(w, r)
	case "/api/previous-question":
		handlePreviousQuestion(w, r)
	case "/api/next-question":
		handleNextQuestion(w, r)
	case "/api/start-question":
		handleStartQuestion(w, r)
	default:
		http.NotFound(w, r)
	}
}

// handleGameState responds to API requests for the current game state.
// The Game State is a singleton that holds the current state of the game
// such as what question we are currently playing etc.
// It retrieves the game state from the game singleton, applies any
// decoration specific to the user makeing the request and then
// returns it as JSON.
// If the JSON encoding fails, it returns a 500 Internal Server Error
func handleGameState(w http.ResponseWriter, r *http.Request) {
	// get the game state from the game singleton
	state := game.GetGame()
	// Encode the state as JSON and send it back
	err := json.NewEncoder(w).Encode(state)
	if err != nil {
		http.Error(w, "Failed to encode game state", http.StatusInternalServerError)
		return
	}
	// TODO decorate gamestate with user information from session
	// Handle gamestate question timer
}

func handlePreviousQuestion(w http.ResponseWriter, r *http.Request) {
	// game.StartGame() should apply the timestamp of the start of the game
	logger.Info("Handling next question request")
}

func handleNextQuestion(w http.ResponseWriter, r *http.Request) {
	// game.StartGame() should apply the timestamp of the start of the game
	logger.Info("Handling next question request")
}

func handleStartQuestion(w http.ResponseWriter, r *http.Request) {
	game.GetGame().StartQuestion()
}

func handleSubmitAnswer(w http.ResponseWriter, r *http.Request) {
	logger.Info("Handling submit answer request")
	// For example, you might want to process the submitted answer and update the game state
}
