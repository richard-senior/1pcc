// internal/handlers/api.go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/session"
)

// GameStateResponse represents the JSON structure we'll send to clients
type GameStateResponse struct {
	Players         map[string]*game.Player `json:"players"`
	CurrentQuestion *game.Question          `json:"currentQuestion,omitempty"`
	QuestionNumber  int                     `json:"questionNumber"`
	TotalQuestions  int                     `json:"totalQuestions"`
	Error           string                  `json:"error,omitempty"`
}

// GameAPIHandler handles all game state API requests
func GameAPIHandler(w http.ResponseWriter, r *http.Request) {
	// Set JSON content type
	w.Header().Set("Content-Type", "application/json")

	// Get game instance
	gameInstance := game.GetGame()

	// Get current question number and total
	currentQ, totalQ := gameInstance.GetGameProgress()

	// Create response
	response := GameStateResponse{
		Players:         gameInstance.GetAllPlayers(),
		CurrentQuestion: gameInstance.GetCurrentQuestion(),
		QuestionNumber:  currentQ,
		TotalQuestions:  totalQ,
	}

	// Send response
	json.NewEncoder(w).Encode(response)
}

// SubmitAnswerRequest represents the expected JSON structure for answer submissions
type SubmitAnswerRequest struct {
	Answer string `json:"answer"`
}

// SubmitAnswerHandler handles answer submissions via API
func SubmitAnswerHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Decode the request
	var req SubmitAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid request format",
		})
		return
	}

	// Submit answer to game
	gameInstance := game.GetGame()
	username := session.GetUsername(r)
	gameInstance.SetAnswer(username, req.Answer)

	// Return success
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
	})
}
