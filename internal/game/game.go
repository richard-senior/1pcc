// internal/game/game.go
package game

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/richard-senior/1pcc/internal/logger"
	"github.com/richard-senior/1pcc/internal/session"
)

// GameState represents the complete game state and UI configuration
type GameState struct {
	// Game core data
	Players         map[string]*Player `json:"players"`
	AllQuestions    []Question         `json:"allQuestions"`
	AllAnswers      []Answer           `json:"allAnswers,omitempty"`
	CurrentQuestion *Question          `json:"currentQuestion,omitempty"`
	TotalQuestions  int                `json:"totalQuestions"`
	// Session/User data
	CurrentUser *Player `json:"currentUser,omitempty"`
}

type Player struct {
	Username    string   `json:"username"`
	Score       int      `json:"score"`
	Answers     []Answer `json:"answers,omitempty"`
	IsAdmin     bool     `json:"isAdmin,omitempty"`
	IsSpectator bool     `json:"isSpectator,omitempty"`
	IpAddress   string   `json:"ipaddress,omitempty"`
}

type Question struct {
	Question        string    `json:"question"`
	QuestionNumber  int       `json:"questionNumber"`
	ImageUrl        string    `json:"imageUrl,omitempty"`
	Type            string    `json:"type"` // "multiple_choice" or "text"
	Choices         []string  `json:"choices,omitempty"`
	CorrectAnswer   string    `json:"correctAnswer"`
	HostAnswer      string    `json:"hostAnswer"` // Only included for admin
	PointsAvailable int       `json:"pointsAvailable"`
	TimeLimit       int       `json:"timeLimit"`
	TimeStarted     time.Time `json:"timeStarted,omitempty"`
	TimeLeft        int       `json:"timeLeft,omitempty"`
	IsTimedOut      bool      `json:"isTimedOut,omitempty"`
	ClickImage      string    `json:"clickImage,omitempty"`
	StreetView      string    `json:"streetView,omitempty"`
}

type Answer struct {
	QuestionNumber int    `json:"questionNumber"`
	Username       string `json:"username"`
	Answer         string `json:"answer"`
	Points         int    `json:"points"`
}

var (
	instance  *GameState
	prevCount *int
	once      sync.Once
	mu        sync.RWMutex
)

// GetGame returns the singleton instance of the game
func GetGame() *GameState {
	once.Do(func() {
		logger.Info("Creating Gamestate Singleton")
		instance = NewGameState() // Using the existing NewGameState function
		// load in the questions
		file, err := os.ReadFile("./questions.json")
		if err != nil {
			logger.Error("Failed to read questions file")
			os.Exit(1)
		}
		var questions []Question
		if err := json.Unmarshal(file, &questions); err != nil {
			logger.Error("Failed to unmarshal questions file. Lint the JSON file for errors")
			os.Exit(1)
		}
		if len(questions) > 0 {
			instance.CurrentQuestion = &questions[0]
		} else {
			logger.Error("There are no questions in the questions.json file. Cannot continue..")
			os.Exit(1)
		}
		instance.AllQuestions = questions // Changed from Questions to AllQuestions
		instance.TotalQuestions = len(instance.AllQuestions)
		logger.Info(fmt.Sprintf("%d questions loaded.. game state initiated", instance.TotalQuestions))
	})
	/*
		calculate dynamic fields on the game state, trigger events etc.
		be very careful calling methods outside of GetGame as most of them will
		reference GetGame and cause a loop
	*/
	decorateGameState(instance)
	// return the instance
	return instance
}

func decorateGameState(gs *GameState) {
	mu.Lock()
	defer mu.Unlock()
	// Calculate the time remaining on the current question
	// first get the question in a thread safe non-recusion inducing fashion
	cq := gs.CurrentQuestion
	if cq != nil {
		// Check if TimeStarted is non-zero (time.Time's zero value)
		if !cq.TimeStarted.IsZero() {
			// Calculate elapsed time since question started
			elapsed := time.Since(cq.TimeStarted).Seconds()
			// Calculate remaining time in seconds
			// TimeLimit is in seconds, subtract elapsed time
			remainingTime := float64(cq.TimeLimit) - elapsed
			remainingInt := int(remainingTime)
			// If time is up, set to 0 and mark as timed out
			if remainingInt <= 0 {
				cq.TimeLeft = 0
				cq.IsTimedOut = true
				if prevCount != nil && *prevCount > 0 {
					remainingInt = 0
					prevCount = &remainingInt
					cq.TimeStarted = time.Time{}
					// trigger question timed out event
					onQuestionTimeout(gs)
				}
			} else {
				cq.TimeLeft = remainingInt
				prevCount = &remainingInt
				logger.Info(fmt.Sprintf("Time remaining: %d seconds", remainingInt))
			}
		}
	}
	// TODO more calculation here
}

func onQuestionTimeout(gs *GameState) {
	/* CAUTION this event is triggered from inside GetGame */
	logger.Info("Question timed out.. doQuestionTimeout")
	// calculate player scores
	// update player stats
}

// In game.go, change the function to be a method on GameState
func (gs *GameState) AddPlayer(username string, isAdmin bool, isObserver bool, ipAddress string) {
	mu.Lock()
	defer mu.Unlock()
	if _, exists := gs.Players[username]; !exists {
		gs.Players[username] = &Player{
			Username:    username,
			Score:       0,
			IsAdmin:     isAdmin,
			IsSpectator: isAdmin,
			IpAddress:   ipAddress,
		}
	}
}

// RemovePlayer removes a player from the game
func (gs *GameState) RemovePlayer(username string) {
	mu.Lock()
	defer mu.Unlock()
	delete(gs.Players, username)
}

func (gs *GameState) SetPlayerAdmin(username string) {
	mu.Lock()
	defer mu.Unlock()
	if player, exists := gs.Players[username]; exists {
		player.IsAdmin = true
	}
}

// Add this to game/game.go
// this is kind of a 'static' function
// that is, we can access it from anywhere with just GetMe(r) etc.
func GetMe(r *http.Request) *Player {
	username := session.GetUsername(r)
	gs := GetGame()
	if player, exists := gs.Players[username]; exists {
		return player
	}
	return nil
}

// GetLeaderboard returns a sorted list of players by score
func (gs *GameState) GetLeaderboard() []*Player {
	players := make([]*Player, 0, len(gs.Players))
	for _, player := range gs.Players {
		players = append(players, player)
	}

	sort.Slice(players, func(i, j int) bool {
		return players[i].Score > players[j].Score
	})

	return players
}

func (gs *GameState) NextQuestion() {
	mu.Lock()
	defer mu.Unlock()
	var ccn int
	if gs.CurrentQuestion == nil {
		ccn = 0
	} else {
		if gs.CurrentQuestion.QuestionNumber < len(gs.AllQuestions)-1 {
			ccn = gs.CurrentQuestion.QuestionNumber + 1
		} else {
			ccn = len(gs.AllQuestions) - 1 // Stay at last question
		}
	}
	// Set the current question to the new question number
	gs.CurrentQuestion = &instance.AllQuestions[ccn]
}

// returns to the previous question
func (gs *GameState) PreviousQuestion() {
	mu.Lock()
	defer mu.Unlock()
	if instance == nil {
		return
	}
	var ccn int
	if gs.CurrentQuestion == nil {
		ccn = 0
	} else {
		if gs.CurrentQuestion.QuestionNumber > 0 {
			ccn = gs.CurrentQuestion.QuestionNumber - 1
		} else {
			ccn = 0
		}
	}
	// now we have the question number then set the current question appropriately
	gs.CurrentQuestion = &instance.AllQuestions[ccn]
}

// GetCurrentQuestion returns the current question
func (gs *GameState) GetCurrentQuestion() *Question {
	if gs.CurrentQuestion == nil {
		return nil
	}
	return gs.CurrentQuestion
}

// StartGame initializes and starts the game
func (gs *GameState) StartQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	if cq == nil {
		gs.NextQuestion()
	}
	if cq != nil {
		cq.TimeStarted = time.Now()
	}
}

// NewGameState creates a new GameState with initialized maps and questions
func NewGameState() *GameState {
	gs := &GameState{
		Players: make(map[string]*Player),
	}
	// Load questions from JSON file
	file, err := os.ReadFile("questions.json")
	if err != nil {
		// In a production environment, you might want to handle this error differently
		return gs
	}
	var questions []Question
	if err := json.Unmarshal(file, &questions); err != nil {
		return gs
	}

	gs.AllQuestions = questions
	gs.TotalQuestions = len(questions)

	// Set the first question as current if available
	if len(questions) > 0 {
		logger.Info("Loaded first question into gamestate")
		gs.CurrentQuestion = &questions[0]
	}

	return gs
}
