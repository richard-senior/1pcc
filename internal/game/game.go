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
	CurrentQuestion *Question          `json:"currentQuestion,omitempty"`
	TotalQuestions  int                `json:"totalQuestions"`
	// Session/User data
	CurrentUser *Player `json:"currentUser,omitempty"`
}

type Player struct {
	Username    string `json:"username"`
	Score       int    `json:"score"`
	Percent     int    `json:"percent"`
	IsAdmin     bool   `json:"isAdmin,omitempty"`
	IsSpectator bool   `json:"isSpectator,omitempty"`
	IpAddress   string `json:"ipaddress,omitempty"`
}

type Question struct {
	Answers            []Answer  `json:"answers,omitempty"`        // as users answer, they'll be added to this list
	Question           string    `json:"question"`                 // the actual question text to show the users
	QuestionNumber     int       `json:"questionNumber,omitempty"` // the question number, this should be worked out dynamically
	ImageUrl           string    `json:"imageUrl,omitempty"`       // if there's an image this should be the local path or remote url
	Link               string    `json:"link,omitempty"`           // this is for showing info about the correct answer
	Type               string    `json:"type"`                     // "multiple_choice" or "text"
	Choices            []string  `json:"choices,omitempty"`        // if this is multichoice, then these are the choices
	CorrectAnswer      string    `json:"correctAnswer"`            // indicates the correct answer, can be anything from coordinates to a name etc.
	PenalisationFactor float32   `json:"penalisationFactor"`       // for geoguessing, how harsh to be. The higher the number the harsher
	HostAnswer         string    `json:"hostAnswer"`               // Only included for admin
	PointsAvailable    int       `json:"pointsAvailable"`          // how many points are available for this question
	TimeLimit          int       `json:"timeLimit"`                // how long do the users have to answer?
	TimeStarted        time.Time `json:"timeStarted,omitempty"`    // when did this question start
	TimeLeft           int       `json:"timeLeft,omitempty"`       // how long has the user left to answer this question
	IsTimedOut         bool      `json:"isTimedOut,omitempty"`     // has the question been run and finished?
	ClickImage         string    `json:"clickImage,omitempty"`     // if this is a click question then the local path to the image we're clicking on
	StreetView         string    `json:"streetView,omitempty"`     // if this is a geoguesser then the specific info required for streetview
}

type Answer struct {
	QuestionNumber int    `json:"questionNumber"`
	Username       string `json:"username"`
	Answer         string `json:"answer"`
	Comment        string `json:"comment"`
	Points         int    `json:"points"`
}

var (
	instance  *GameState
	prevCount *int
	once      sync.Once
	mu        sync.RWMutex
)

// In game.go, modify the GetGame() function:
func GetGame() *GameState {
	once.Do(func() {
		logger.Info("Creating Gamestate Singleton")
		instance = NewGameState()
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

		// Assign question numbers sequentially, 1-based
		for i := range questions {
			questions[i].QuestionNumber = i + 1
		}

		if len(questions) > 0 {
			instance.CurrentQuestion = &questions[0]
		} else {
			logger.Error("There are no questions in the questions.json file. Cannot continue..")
			os.Exit(1)
		}
		instance.AllQuestions = questions
		instance.TotalQuestions = len(instance.AllQuestions)
		logger.Info(fmt.Sprintf("%d questions loaded.. game state initiated", instance.TotalQuestions))
	})

	decorateGameState(instance)
	return instance
}

func decorateGameState(gs *GameState) {

	todo have all players answered? If they have stop the game
	find out why stop game isn't stopping it
	implement un-pause question
	implement map clicker games
	implement image clicker games
	show all players on current answer table even if they haven't answered
	on observe page show answer explainations and links on question ended
	implement multi-choice

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
				cq.IsTimedOut = false
				cq.TimeLeft = remainingInt
				prevCount = &remainingInt
				// logger.Info(fmt.Sprintf("Time remaining: %d seconds", remainingInt))
			}
		}
	}
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

func (gs *GameState) SetPlayerSpectator(username string) {
	mu.Lock()
	defer mu.Unlock()
	if player, exists := gs.Players[username]; exists {
		player.IsSpectator = true
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

func (gs *GameState) getCurrentMaxPoints() int {
	cq := gs.CurrentQuestion
	if cq == nil {
		return 0
	}
	// Iterate through all questions
	totalPoints := 0
	// Sum points from first question up to current question number
	for i := 1; i < cq.QuestionNumber; i++ {
		totalPoints += gs.AllQuestions[i-1].PointsAvailable
	}
	// Add current question's points
	totalPoints += cq.PointsAvailable

	return totalPoints
}

func (gs *GameState) GetLeaderboard() []*Player {
	// Create a map to store running totals for each player
	playerScores := make(map[string]int)

	// Iterate through all questions
	for _, question := range gs.AllQuestions {
		// For each question, sum up the points from answers
		for _, answer := range question.Answers {
			playerScores[answer.Username] += answer.Points
		}
	}

	pa := gs.getCurrentMaxPoints()
	logger.Info("current points available are " + fmt.Sprintf("%d", pa))

	// Update player scores and calculate percentages in the GameState
	for username, totalScore := range playerScores {
		if player, exists := gs.Players[username]; exists {
			player.Score = totalScore
			// Calculate percentage (avoid divide by zero)
			if pa > 0 {
				percentage := int((float32(totalScore) * 100.0) / float32(pa))
				// Clamp the percentage between 0 and 100
				if percentage > 100 {
					player.Percent = 100
				} else if percentage < 0 {
					player.Percent = 0
				} else {
					player.Percent = percentage
				}
				// now invert the percentage
				player.Percent = 100 - player.Percent

				if player.Percent < 1 {
					player.Percent = 1
				} else if player.Percent > 100 {
					player.Percent = 100
				}
			} else {
				player.Percent = 100 // If no points available, percentage should be 0
			}
		}
	}

	// Create a slice of players for sorting
	players := make([]*Player, 0, len(gs.Players))
	for _, player := range gs.Players {
		players = append(players, player)
	}

	// Sort players by score in descending order
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
		ccn = 1
	} else {
		if gs.CurrentQuestion.QuestionNumber < len(gs.AllQuestions) {
			ccn = gs.CurrentQuestion.QuestionNumber + 1
		} else {
			ccn = len(gs.AllQuestions) // Stay at last question
		}
	}
	// Set the current question to the new question number
	gs.CurrentQuestion = &instance.AllQuestions[ccn-1]
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
		ccn = 1
	} else {
		if gs.CurrentQuestion.QuestionNumber > 1 {
			ccn = gs.CurrentQuestion.QuestionNumber
		} else {
			ccn = 1
		}
	}
	// now we have the question number then set the current question appropriately
	gs.CurrentQuestion = &instance.AllQuestions[ccn-1]
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

func (gs *GameState) PauseQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	if cq == nil {
		gs.NextQuestion()
	}
	if cq != nil {
		cq.TimeStarted = time.Time{}
	}
}

func (gs *GameState) StopQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	if cq == nil {
		gs.NextQuestion()
	}
	if cq != nil {
		cq.TimeStarted = time.Time{}
		onQuestionTimeout(gs)
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
