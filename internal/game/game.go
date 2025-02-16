// internal/game/game.go
package game

import (
	"encoding/json"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type Question struct {
	Question  string   `json:"question"`
	Choices   []string `json:"choices,omitempty"` // Optional array of choices
	Answer    string   `json:"answer"`
	TimeLimit int      `json:"timeLimit"`
	Type      string   `json:"type"` // "multiple_choice" or "text"
}

type Player struct {
	Name    string
	Score   int
	Answer  string
	Answers map[int]string
}

type GameState struct {
	Players         map[string]*Player
	Questions       []Question
	CurrentQuestion int
	mu              sync.RWMutex
}

var (
	instance *GameState
	once     sync.Once
)

// GetGame returns the singleton instance of the game
func GetGame() *GameState {
	once.Do(func() {
		instance = &GameState{
			Players:         make(map[string]*Player),
			CurrentQuestion: 0,
		}
		if err := instance.loadQuestions("./questions.json"); err != nil {
			// In a real application, you might want to handle this error differently
			panic("Failed to load questions: " + err.Error())
		}
	})
	return instance
}

// Add this method to your GameState struct
func (g *GameState) GetAllPlayers() map[string]*Player {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.Players
}

// CheckAllAnswers evaluates all player answers for the current question
func (g *GameState) CheckAllAnswers() map[string]bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	results := make(map[string]bool)
	currentQuestion := g.Questions[g.CurrentQuestion]

	// Iterate through all players and check their answers
	for username, player := range g.Players {
		if answer, exists := player.Answers[g.CurrentQuestion]; exists {
			// Compare player's answer with correct answer (case insensitive)
			isCorrect := strings.EqualFold(answer, currentQuestion.Answer)
			results[username] = isCorrect

			// Update player's score if correct
			if isCorrect {
				player.Score++
			}
		} else {
			// Player didn't answer
			results[username] = false
		}
	}

	return results
}

// loadQuestions loads questions from a JSON file
func (g *GameState) loadQuestions(filepath string) error {
	file, err := os.ReadFile(filepath)
	if err != nil {
		return err
	}

	var questions []Question
	if err := json.Unmarshal(file, &questions); err != nil {
		return err
	}

	g.mu.Lock()
	g.Questions = questions
	g.mu.Unlock()

	return nil
}

// GetCurrentQuestion returns the current question
func (g *GameState) GetCurrentQuestion() *Question {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if len(g.Questions) == 0 {
		return nil
	}
	return &g.Questions[g.CurrentQuestion]
}

// AdvanceQuestion moves to the next question
func (g *GameState) AdvanceQuestion() bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.CurrentQuestion >= len(g.Questions)-1 {
		return false
	}

	g.CurrentQuestion++
	return true
}

// ResetGame resets the game state
func (g *GameState) ResetGame() {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.CurrentQuestion = 0
	g.Players = make(map[string]*Player)
}

func (g *GameState) AddPlayer(name string) *Player {
	g.mu.Lock()
	defer g.mu.Unlock()

	player := &Player{
		Name:    name,
		Score:   0,
		Answers: make(map[int]string), // Initialize the answers map
	}
	g.Players[name] = player
	return player
}

func (g *GameState) GetPlayer(name string) (*Player, bool) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	player, exists := g.Players[name]
	return player, exists
}

func (g *GameState) SetAnswer(name, answer string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	if player, exists := g.Players[name]; exists {
		player.Answer = answer
		player.Answers[g.CurrentQuestion] = answer // Store the answer for the current question
		return true
	}
	return false
}

// CheckAnswer checks if a player's answer is correct and updates their score
func (g *GameState) CheckAnswer(playerName string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	player, exists := g.Players[playerName]
	if !exists {
		return false
	}

	currentQ := g.Questions[g.CurrentQuestion]
	if player.Answer == currentQ.Answer {
		player.Score++
		return true
	}
	return false
}

// GetTimeLimit returns the time limit for the current question
func (g *GameState) GetTimeLimit() time.Duration {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if len(g.Questions) == 0 {
		return 0
	}
	return time.Duration(g.Questions[g.CurrentQuestion].TimeLimit) * time.Second
}

// GetGameProgress returns the current question number and total questions
func (g *GameState) GetGameProgress() (current, total int) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	return g.CurrentQuestion + 1, len(g.Questions)
}

// IsGameOver checks if all questions have been answered
func (g *GameState) IsGameOver() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	return g.CurrentQuestion >= len(g.Questions)-1
}

// GetLeaderboard returns a sorted list of players by score
func (g *GameState) GetLeaderboard() []Player {
	g.mu.RLock()
	defer g.mu.RUnlock()

	leaderboard := make([]Player, 0, len(g.Players))
	for _, player := range g.Players {
		leaderboard = append(leaderboard, *player)
	}

	// Sort by score (highest first)
	sort.Slice(leaderboard, func(i, j int) bool {
		return leaderboard[i].Score > leaderboard[j].Score
	})

	return leaderboard
}

// internal/game/game.go

// IsMultipleChoice returns true if the current question is multiple choice
func (g *GameState) IsMultipleChoice() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if len(g.Questions) == 0 {
		return false
	}
	return g.Questions[g.CurrentQuestion].Type == "multiple_choice"
}

// GetCurrentQuestionData returns all data for the current question
func (g *GameState) GetCurrentQuestionData() *Question {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if len(g.Questions) == 0 {
		return nil
	}

	// Return a copy to prevent modification of the original
	q := g.Questions[g.CurrentQuestion]
	return &q
}

// ValidateAnswer checks if the answer is valid for the current question type
func (g *GameState) ValidateAnswer(answer string) bool {
	q := g.GetCurrentQuestionData()
	if q == nil {
		return false
	}

	if q.Type == "multiple_choice" {
		// For multiple choice, answer must be one of the choices
		for _, choice := range q.Choices {
			if choice == answer {
				return true
			}
		}
		return false
	}

	// For text questions, any non-empty answer is valid
	return answer != ""
}
