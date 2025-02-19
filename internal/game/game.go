// internal/game/game.go
package game

import (
	"encoding/json"
	"errors"
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
	CurrentQuestion *Question          `json:"currentQuestion,omitempty"`
	TotalQuestions  int                `json:"totalQuestions"`

	// Session/User data
	CurrentUser *Player `json:"currentUser,omitempty"`
}

type Player struct {
	Username   string    `json:"username"`
	Score      int       `json:"score"`
	Answer     string    `json:"answer,omitempty"`
	IsOnline   bool      `json:"isOnline"`
	LastActive time.Time `json:"lastActive"`
	IsAdmin    bool      `json:"isAdmin"`
}

type Question struct {
	Question       string    `json:"question"`
	QuestionNumber int       `json:"questionNumber"`
	ImageUrl       string    `json:"imageUrl,omitempty"`
	Type           string    `json:"type"` // "multiple_choice" or "text"
	Choices        []string  `json:"choices,omitempty"`
	Answer         string    `json:"answer,omitempty"` // Only included for admin
	TimeLimit      int       `json:"timeLimit"`
	TimeStarted    time.Time `json:"timeStarted,omitempty"`
	TimeLeft       int       `json:"timeLeft,omitempty"`
	IsTimedOut     bool      `json:"isTimedOut,omitempty"`
	ClickImage     string    `json:"clickImage,omitempty"`
	StreetView     string    `json:"streetview,omitempty"`
}

var (
	instance *GameState
	once     sync.Once
	mu       sync.RWMutex
)

// GetGame returns the singleton instance of the game
func GetGame() *GameState {
	once.Do(func() {
		logger.Info("Creating Gamestate Singleton")
		instance = NewGameState() // Using the existing NewGameState function
		if err := loadQuestions("./questions.json"); err != nil {
			panic("Failed to load questions: " + err.Error())
		}
		instance.TotalQuestions = len(instance.AllQuestions)
		logger.Info(fmt.Sprintf("%d questions loaded.. game state initiated", instance.TotalQuestions))
	})
	// Calculate the time remaining on the current question
	cq := instance.GetCurrentQuestion()
	if cq != nil {
		logger.Info(fmt.Sprintf("Current question: %d", cq.QuestionNumber))
		logger.Info(cq.Question)
		// Check if TimeStarted is non-zero (time.Time's zero value)
		if !cq.TimeStarted.IsZero() {
			// Calculate elapsed time since question started
			elapsed := time.Since(cq.TimeStarted).Seconds()

			// Calculate remaining time in seconds
			// TimeLimit is in seconds, subtract elapsed time
			remainingTime := float64(cq.TimeLimit) - elapsed

			// If time is up, set to 0 and mark as timed out
			if remainingTime <= 0 {
				cq.TimeLeft = 0
				cq.IsTimedOut = true
			} else {
				// Round down to nearest second and store
				cq.TimeLeft = int(remainingTime)
			}
			logger.Info(fmt.Sprintf("Time left: %d", cq.TimeLeft))
		}
	}
	return instance
}

// In game.go, change the function to be a method on GameState
func (gs *GameState) AddPlayer(username string) {
	mu.Lock()
	defer mu.Unlock()

	if _, exists := gs.Players[username]; !exists {
		gs.Players[username] = &Player{
			Username:   username,
			Score:      0,
			IsOnline:   true,
			LastActive: time.Now(),
		}
	}
}

// RemovePlayer removes a player from the game
func (gs *GameState) RemovePlayer(username string) {
	mu.Lock()
	defer mu.Unlock()
	delete(instance.Players, username)
}

func (gs *GameState) SetPlayerAdmin(username string) {
	mu.Lock()
	defer mu.Unlock()
	if player, exists := instance.Players[username]; exists {
		player.IsAdmin = true
	}
}

// Add this to game/game.go
func GetMe(r *http.Request) *Player {
	mu.RLock()
	defer mu.RUnlock()
	username := session.GetUsername(r)
	if player, exists := instance.Players[username]; exists {
		return player
	}
	return nil
}

func (gs *GameState) GetAllPlayers() map[string]*Player {
	mu.RLock()
	defer mu.RUnlock()
	return instance.Players
}

// CheckAllAnswers evaluates all player answers for the current question
func (gs *GameState) CheckAllAnswers() map[string]bool {
	mu.Lock()
	defer mu.Unlock()
	results := make(map[string]bool)

	if instance.CurrentQuestion == nil {
		return results
	}

	// Iterate through all players and check their answers
	for username, player := range instance.Players {
		if player.Answer == instance.CurrentQuestion.Answer {
			results[username] = true
			player.Score++
		} else {
			results[username] = false
		}
		player.Answer = "" // Reset answer for next question
	}
	return results
}

// Add this to game.go
func (gs *GameState) ValidateAnswer(username, answer string) (bool, error) {
	mu.RLock()
	defer mu.RUnlock()

	player, exists := gs.Players[username]
	if !exists {
		return false, errors.New("player not found")
	}

	if gs.CurrentQuestion == nil {
		return false, errors.New("no current question")
	}

	// Store the answer
	player.Answer = answer
	player.LastActive = time.Now()

	// Return whether the answer is correct
	return answer == gs.CurrentQuestion.Answer, nil
}

// SubmitAnswer submits an answer for a player
func (gs *GameState) SubmitAnswer(username, answer string) error {
	mu.Lock()
	defer mu.Unlock()
	if player, exists := instance.Players[username]; exists {
		player.Answer = answer
		player.LastActive = time.Now()
		return nil
	}
	return errors.New("player not found")
}

// GetLeaderboard returns a sorted list of players by score
func (gs *GameState) GetLeaderboard() []*Player {
	mu.RLock()
	defer mu.RUnlock()

	players := make([]*Player, 0, len(instance.Players))
	for _, player := range instance.Players {
		players = append(players, player)
	}

	sort.Slice(players, func(i, j int) bool {
		return players[i].Score > players[j].Score
	})

	return players
}

// loadQuestions loads questions from a JSON file
func loadQuestions(filename string) error {
	file, err := os.ReadFile(filename)
	if err != nil {
		return err
	}

	var questions []Question
	if err := json.Unmarshal(file, &questions); err != nil {
		return err
	}

	if len(questions) > 0 {
		instance.CurrentQuestion = &questions[0]
	}
	instance.AllQuestions = questions // Changed from Questions to AllQuestions
	return nil
}

func (gs *GameState) NextQuestion() {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		return
	}

	var ccn int
	if instance.CurrentQuestion == nil {
		ccn = 0
	} else {
		if instance.CurrentQuestion.QuestionNumber < len(instance.AllQuestions)-1 {
			ccn = instance.CurrentQuestion.QuestionNumber + 1
		} else {
			ccn = len(instance.AllQuestions) - 1 // Stay at last question
		}
	}

	// Set the current question to the new question number
	instance.CurrentQuestion = &instance.AllQuestions[ccn]
}

// returns to the previous question
func (gs *GameState) PreviousQuestion() {
	mu.Lock()
	defer mu.Unlock()
	if instance == nil {
		return
	}
	var ccn int
	if instance.CurrentQuestion == nil {
		ccn = 0
	} else {
		if instance.CurrentQuestion.QuestionNumber > 0 {
			ccn = instance.CurrentQuestion.QuestionNumber - 1
		} else {
			ccn = 0
		}
	}
	// now we have the question number then set the current question appropriately
	instance.CurrentQuestion = &instance.AllQuestions[ccn]
}

// GetCurrentQuestion returns the current question
func (gs *GameState) GetCurrentQuestion() *Question {
	mu.RLock()
	defer mu.RUnlock()
	if instance == nil {
		return nil
	}
	if instance.CurrentQuestion == nil {
		return nil
	}
	return instance.CurrentQuestion
}

// UpdatePlayerStatus updates a player's online status and last active time
func (gs *GameState) UpdatePlayerStatus(username string, isOnline bool) {
	mu.Lock()
	defer mu.Unlock()

	if player, exists := instance.Players[username]; exists {
		player.IsOnline = isOnline
		player.LastActive = time.Now()
	}
}

// StartGame initializes and starts the game
func (gs *GameState) StartQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	if cq == nil {
		instance.NextQuestion()
	}
	if cq != nil {
		cq.TimeStarted = time.Now()
	} else {
		logger.Warn("No current question to start")
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
