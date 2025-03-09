/*
	handlers/api.go

Implements functions for a JSON API used by client side code
to hydrate pages with game and user details.
*/
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/logger"
	"github.com/richard-senior/1pcc/internal/session"
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
	path := strings.TrimSuffix(r.URL.Path, "/") // Remove trailing slash if present
	switch path {
	case "/api/game-state":
		handleGameState(w, r)
	case "/api/get-leaderboard":
		handleGetLeaderboard(w, r)
	case "/api/submit-answer":
		handleSubmitAnswer(w, r)
	case "/api/previous-question":
		handlePreviousQuestion(w, r)
	case "/api/next-question":
		handleNextQuestion(w, r)
	case "/api/start-question":
		handleStartQuestion(w, r)
	case "/api/pause-question":
		handlePauseQuestion(w, r)
	case "/api/stop-question":
		handleStopQuestion(w, r)
	case "/api/players":
		handlePlayers(w, r)
	case "/api/session":
		handleSession(w, r)
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
	p := session.GetMe(r)
	state.CurrentUser = p

	// Encode the state as JSON and send it back
	err := json.NewEncoder(w).Encode(state)
	if err != nil {
		http.Error(w, "Failed to encode game state", http.StatusInternalServerError)
		return
	}
}

func handleGetLeaderboard(w http.ResponseWriter, r *http.Request) {
	// get the game state from the game singleton
	lb := game.GetGame().GetLeaderboard()
	// Encode the state as JSON and send it back
	err := json.NewEncoder(w).Encode(lb)
	if err != nil {
		http.Error(w, "Failed to encode players array", http.StatusInternalServerError)
		return
	}
}

func handlePreviousQuestion(w http.ResponseWriter, r *http.Request) {
	gs := game.GetGame()
	gs.PreviousQuestion()
}

func handleNextQuestion(w http.ResponseWriter, r *http.Request) {
	gs := game.GetGame()
	gs.NextQuestion()
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
func handlePauseQuestion(w http.ResponseWriter, r *http.Request) {
	game.GetGame().PauseQuestion()
}
func handleStopQuestion(w http.ResponseWriter, r *http.Request) {
	game.GetGame().StopQuestion()
}
func handleSession(w http.ResponseWriter, r *http.Request) {
	type SessionResponse struct {
		IsLoggedIn bool `json:"isLoggedIn"`
	}
	response := SessionResponse{
		IsLoggedIn: session.IsUserLoggedIn(w, r),
	}
	err := json.NewEncoder(w).Encode(response)
	if err != nil {
		http.Error(w, "Failed to encode session response", http.StatusInternalServerError)
		return
	}
}
func handlePlayers(w http.ResponseWriter, r *http.Request) {
	au := session.GetMe(r)
	if au == nil || !au.IsAdmin {
		return
	}
	username := r.URL.Query().Get("username")
	action := r.URL.Query().Get("action")
	points := r.URL.Query().Get("points")

	if username == "" || action == "" {
		return
	}
	if !game.PlayerExists(username) {
		return
	}
	player := game.GetPlayer(username)

	switch action {
	case "kick":
		logger.Warn("Kicking player", "username", player.Username)
		session.EjectByUsername(player.Username)
	case "ban":
		logger.Warn("Banning player", "username", player.Username)
		session.Ban(player.Username)
	case "dock":
		logger.Warn("Docking player", "username", player.Username)
		pointsFloat, err := strconv.ParseFloat(points, 32)
		if err != nil {
			http.Error(w, "Invalid points value", http.StatusBadRequest)
			return
		}
		player.Score -= float32(pointsFloat)
	case "award":
		logger.Warn(fmt.Sprintf("Awarding player: %s - %s", player.Username, points))
		game.Award(player.Username, points)
	case "msg":
		if points == "" {
			return
		}
		game.MessagePlayer(username, points, 5)
	default:
		logger.Warn("Invalid action in players handler")
		return
	}
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
	// dont add another answer if one already exists
	for _, a := range cq.Answers {
		if a.Username == answer.Username {
			return
		}
	}
	// add the answer to the question.Answers array
	cq.Answers = append(cq.Answers, answer)
	// order the answers by score

	sort.Slice(cq.Answers, func(i, j int) bool {
		return cq.Answers[i].Points > cq.Answers[j].Points
	})
}
