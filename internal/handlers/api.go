/*
	handlers/api.go

Implements functions for a JSON API used by client side code
to hydrate pages with game and user details.
*/
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/logger"
)

/*
api.go is given a path of /api/... such that it handles
all requests to /api/... and all sub paths
so we must handle here any possible calls to /api/...
and then delegate to the appropriate handler

Input:
  - w http.ResponseWriter: The response writer to write the JSON response to
  - r *http.Request: The incoming HTTP request

Output:
  - Returns no direct output, but writes to the http.ResponseWriter:
  - On success: JSON encoded game.State with 200 status code
  - On error: 500 status code with error message
*/
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

/*
handleGameState responds to API requests for the current game state.
The Game State is a singleton that holds the current state of the game
such as what question we are currently playing etc.
It retrieves the game state from the game singleton, applies any
decoration specific to the user makeing the request and then
returns it as JSON.
If the JSON encoding fails, it returns a 500 Internal Server Error

Input:
  - w http.ResponseWriter: The response writer to write the JSON response to
  - r *http.Request: The incoming HTTP request

Output:
  - Returns no direct output, but writes to the http.ResponseWriter:
  - On success: JSON encoded game.State with 200 status code
  - On error: 500 status code with error message
*/
func handleGameState(w http.ResponseWriter, r *http.Request) {
	// get the game state from the game singleton
	state := game.GetGame()
	// populate some extra fields from session etc.
	p := game.GetMe(r)
	state.CurrentUser = p

	// Encode the state as JSON and send it back
	err := json.NewEncoder(w).Encode(state)
	if err != nil {
		http.Error(w, "Failed to encode game state", http.StatusInternalServerError)
		return
	}
}

func handlePreviousQuestion(w http.ResponseWriter, r *http.Request) {
	// game.StartGame() should apply the timestamp of the start of the game
	logger.Info("Handling next question request")
}

func handleNextQuestion(w http.ResponseWriter, r *http.Request) {
	// game.StartGame() should apply the timestamp of the start of the game
	logger.Info("Handling next question request")
}

/*
See also: game.State, game.GetGame(), game.GetMe()
Delegates to game.StartQuestion() to start the current question
Begins the timer countdown on the current question

Input:
  - w http.ResponseWriter: The response writer to write the JSON response to
  - r *http.Request: The incoming HTTP request

Output:
  - Returns no direct output, but writes to the http.ResponseWriter:
  - On success: JSON encoded game.State with 200 status code
  - On error: 500 status code with error message
*/
func handleStartQuestion(w http.ResponseWriter, r *http.Request) {
	game.GetGame().StartQuestion()
}

/*
Recieves a form post containing a json packet representing a game.Answer
object for this user.
See also: game.Answer etc.
We add that answer to the question.Answers array so that we can
retrospectively calculate scores etc.
*/
func handleSubmitAnswer(w http.ResponseWriter, r *http.Request) {
	logger.Info("Handling submit answer request")
	cg := game.GetGame()
	cq := cg.GetCurrentQuestion()
	// parse the json game.Answer object in the form post
	decoder := json.NewDecoder(r.Body)
	// decode the json into a game.Answer object
	var answer game.Answer
	// decode the json into a game.Answer object
	err := decoder.Decode(&answer)
	// if there was an error decoding the json, return a 500 error
	if err != nil {
		http.Error(w, "Failed to decode answer", http.StatusInternalServerError)
		return
	}
	// add the answer to the question.Answers array
	cq.Answers = append(cq.Answers, answer)
	// For example, you might want to process the submitted answer and update the game state
}
