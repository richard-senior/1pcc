// internal/game/game.go
package game

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/richard-senior/1pcc/internal/logger"
)

// GameState represents the complete game state and UI configuration
type GameState struct {
	// Game core data
	Players         map[string]*Player `json:"players"`
	AllQuestions    []Question         `json:"allQuestions"`
	CurrentQuestion *Question          `json:"currentQuestion"`
	TotalQuestions  int                `json:"totalQuestions"`
	CurrentUser     *Player            `json:"currentUser"`
}

type Player struct {
	Username    string  `json:"username"`
	Score       float32 `json:"score"`
	Percent     int     `json:"percent"`
	IsAdmin     bool    `json:"isAdmin"`
	IsSpectator bool    `json:"isSpectator"`
	IpAddress   string  `json:"ipaddress"`
	Message     string  `json:"message"`
	MessageTime int     `json:"messageTime"`
}

type Question struct {
	Answers            []Answer  `json:"answers"`                      // as users answer, they'll be added to this list
	Question           string    `json:"question"`                     // the actual question text to show the users
	QuestionNumber     int       `json:"questionNumber"`               // the question number, this should be worked out dynamically
	Percent            int       `json:"percent"`                      // the difficulty of the question 100% being very easy and 1% being very difficult
	Category           string    `json:"category"`                     // the category of the question, numbers, cars, actors etc.
	ImageUrl           string    `json:"imageUrl,omitempty"`           // if there's an image this should be the local path or remote url
	Link               string    `json:"link,omitempty"`               // this is for showing info about the correct answer
	Type               string    `json:"type"`                         // "multiple_choice" or "text"
	Choices            []string  `json:"choices,omitempty"`            // if this is multichoice, then these are the choices
	CorrectAnswer      string    `json:"correctAnswer"`                // indicates the correct answer, can be anything from coordinates to a name etc.
	PenalisationFactor float32   `json:"penalisationFactor,omitempty"` // for geoguessing, how harsh to be. The higher the number the harsher
	HostAnswer         string    `json:"hostAnswer,omitempty"`         // Only included for admin
	PointsAvailable    int       `json:"pointsAvailable,omitempty"`    // how many points are available for this question
	TimeLimit          int       `json:"timeLimit,omitempty"`          // how long do the users have to answer?
	TimeLeft           int       `json:"timeLeft"`                     // how long has the user left to answer this question
	TimeStarted        time.Time `json:"timeStarted"`                  // when did this question start
	//IsPaused           bool      `json:"isPaused,omitempty"`       // New field to track pause state
	//PausedAt           time.Time `json:"pausedAt,omitempty"`       // When the question was paused
	//TimeElapsed        float64   `json:"timeElapsed,omitempty"`    // Total time elapsed before pausing
	IsTimedOut bool   `json:"isTimedOut"`           // has the question been run and finished?
	ClickImage string `json:"clickImage,omitempty"` // if this is a click question then the local path to the image we're clicking on
	StreetView string `json:"streetView,omitempty"` // if this is a geoguesser then the specific info required for streetview
}

type Answer struct {
	QuestionNumber int     `json:"questionNumber"`
	Username       string  `json:"username"`
	Answer         string  `json:"answer"`
	Comment        string  `json:"comment"`
	Points         float32 `json:"points"`
}

var (
	instance *GameState
	once     sync.Once
	mu       sync.RWMutex
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

func curatePlayers(gs *GameState) {
	// deal with message duration
	for _, player := range gs.Players {
		mt := player.MessageTime
		if mt > 0 {
			logger.Info(fmt.Sprintf("message time is %d", mt))
			mt = mt - 1
			player.MessageTime = mt
		} else {
			player.Message = ""
		}
	}

}

func decorateGameState(gs *GameState) {
	/*
		find out why stop game isn't stopping it
		implement pause question
		implement un-pause question
		on observe page show answer explainations and links on question ended
	*/
	mu.Lock()
	defer mu.Unlock()
	cq := gs.CurrentQuestion
	if cq == nil {
		logger.Warn("there is no current question in decorate GameState")
		return
	}

	// deals with player curation
	curatePlayers(gs)

	if !cq.IsTimedOut && gs.HaveAllPlayersAnswered() {
		cq.TimeStarted = time.Time{}
		cq.TimeLeft = 0
		cq.IsTimedOut = true
		cq.IsTimedOut = true
		logger.Info("Timed out in have all players answered")
		onQuestionEnded(gs)
		return
	}

	// Calculate the time remaining on the current question
	if !cq.TimeStarted.IsZero() {
		elapsed := time.Since(cq.TimeStarted).Seconds()
		remainingTime := float64(cq.TimeLimit) - elapsed
		remainingInt := int(remainingTime)

		if !cq.IsTimedOut && remainingTime < 0.0 {
			cq.TimeStarted = time.Time{}
			cq.TimeLeft = 0
			cq.IsTimedOut = true
			cq.IsTimedOut = true
			logger.Info("Timed out in loop")
			onQuestionEnded(gs)
		} else {
			cq.TimeLeft = remainingInt
			cq.IsTimedOut = false
			logger.Info(fmt.Sprintf("countdown : %d", cq.TimeLeft))
		}
	}
}

func onQuestionEnded(gs *GameState) {
	logger.Info("Question timed out.. doQuestionTimeout")
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

func MessagePlayer(player string, message string, duration int) {
	if player == "" || message == "" {
		logger.Warn("No player or message given to message player")
		return
	}
	if duration <= 2 {
		duration = 8
	}

	gs := GetGame()
	logger.Info("sending message to player")
	if player, exists := gs.Players[player]; exists {
		player.Message = message
		player.MessageTime = duration
	}
}

/**
* Awards the given player the given points
* Called from api.go etc.
* @param player The player to award
* @param points The points to award
 */
func Award(player string, points string) {
	if player == "" || points == "" {
		logger.Warn("No player or points given to award points")
		return
	}
	gs := GetGame()
	// Declare p at this scope level so it's available throughout the function
	p, exists := gs.Players[player]
	if !exists {
		logger.Warn("Player not found in game state")
		return
	}
	// Convert points to float32 since Score is float32
	pts, err := strconv.ParseFloat(points, 32)
	if err != nil {
		logger.Warn("Can't convert points value to float")
		return
	}
	p.Score += float32(pts)
	pp := gs.Players[player]
	logger.Info("Awarding", player, pp.Score)
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

// In game/game.go
func PlayerExists(username string) bool {
	gs := GetGame()
	if _, exists := gs.Players[username]; exists {
		return true
	}
	return false
}

// And optionally a method to get a specific player
func GetPlayer(username string) *Player {
	gs := GetGame()
	if player, exists := gs.Players[username]; exists {
		return player
	}
	return nil
}

func (gs *GameState) HaveAllPlayersAnswered() bool {
	if gs.CurrentQuestion == nil {
		return false
	}
	// Create a map to track who has answered
	answered := make(map[string]bool)
	for _, answer := range gs.CurrentQuestion.Answers {
		answered[answer.Username] = true
	}
	numRealPlayers := 0
	// Check each player
	for _, player := range gs.Players {
		// Skip spectators and admins as they don't need to answer
		if player.IsSpectator || player.IsAdmin {
			continue
		}
		numRealPlayers++
		// If we find a player who hasn't answered, return false
		if !answered[player.Username] {
			return false
		}
	}
	return numRealPlayers > 0
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
	playerScores := make(map[string]float32)

	// Iterate through all questions
	for _, question := range gs.AllQuestions {
		// For each question, sum up the points from answers
		for _, answer := range question.Answers {
			playerScores[answer.Username] += answer.Points
		}
	}

	pa := gs.getCurrentMaxPoints()
	//logger.Info("current points available are " + fmt.Sprintf("%d", pa))

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
		ccn = min(gs.CurrentQuestion.QuestionNumber+1, len(gs.AllQuestions))
	}
	// Set the current question to the new question number
	gs.CurrentQuestion = &instance.AllQuestions[ccn-1]
	gs.CurrentQuestion.IsTimedOut = false // Reset the flag for the new question
}

func (gs *GameState) PreviousQuestion() {
	mu.Lock()
	defer mu.Unlock()
	// Get current question number
	if gs.CurrentQuestion == nil {
		return
	}
	// Calculate previous question number (1-based indexing)
	prevNum := gs.CurrentQuestion.QuestionNumber - 1
	// Check bounds
	if prevNum < 1 {
		return // Already at first question
	}
	// Set previous question (using 0-based array index)
	gs.CurrentQuestion = &instance.AllQuestions[prevNum-1]
	gs.CurrentQuestion.IsTimedOut = false // Reset the flag for the new question
}

// GetCurrentQuestion returns the current question
func (gs *GameState) GetCurrentQuestion() *Question {
	if gs.CurrentQuestion == nil {
		gs.CurrentQuestion = &instance.AllQuestions[0]
	}
	return gs.CurrentQuestion
}

// StartGame initializes and starts the game
func (gs *GameState) StartQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	// remove any existing answers
	cq.Answers = []Answer{}
	if cq != nil {
		cq.TimeStarted = time.Now()
		cq.TimeLeft = cq.TimeLimit
		cq.IsTimedOut = false // Reset the flag when starting a question
	}
}

func (gs *GameState) PauseQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	if cq != nil && !cq.TimeStarted.IsZero() {
		// Store the current TimeLeft
		elapsed := time.Since(cq.TimeStarted).Seconds()
		cq.TimeLeft = int(float64(cq.TimeLimit) - elapsed)
		cq.TimeStarted = time.Time{} // Setting to zero time effectively pauses
		logger.Info("Question paused with time left: ", cq.TimeLeft)
	}
}

func (gs *GameState) UnPauseQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	if cq != nil && cq.TimeStarted.IsZero() && cq.TimeLeft > 0 {
		// Set new start time based on remaining TimeLeft
		cq.TimeStarted = time.Now().Add(-time.Duration((cq.TimeLimit - cq.TimeLeft)) * time.Second)
		logger.Info("Question unpaused with time left: ", cq.TimeLeft)
	}
}

func (gs *GameState) StopQuestion() {
	mu.Lock()
	defer mu.Unlock()
	cq := gs.GetCurrentQuestion()
	if cq != nil {
		cq.TimeStarted = time.Time{}
		cq.TimeLeft = 0
		onQuestionEnded(gs)
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
		gs.CurrentQuestion.IsTimedOut = false
		gs.CurrentQuestion.TimeLeft = 0
		gs.CurrentQuestion.TimeStarted = time.Time{}
	}

	return gs
}
