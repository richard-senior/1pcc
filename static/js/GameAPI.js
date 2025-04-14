/**
 * Singleton class which manages interaction with the server API
 * Timout without everyone answering prevents question table from showing`
 * Make sure users cannot re-submit questions or re-select anything
 * Connecting wall
 * Spot the ball
 * TODO hard Refresh page if user is not logged in
 */
class GameAPI {
    // 0 = disable logging, 1 = log only 'logClassName' logs, 2 = log everything
    static loggingType = 1;
    static logClassName = "ClickMap"
    constructor() {
        if (GameAPI.instance) {return GameAPI.instance;}
        this.timeLeft = 0;
        this.previousTimeLeft = 0;
        this.state = null;
        this.leaderboard = null; // the current leaderboard (a map of player objects)
        this.currentQuestion = null;
        this.currentUser = null;
        this.pollInterval = null;
        this.failureCount = 0;  // Add failure counter
        this.maxFailures = 1800;   // Maximum failures before stopping polls
        // init the page elements
        this.allPageElements = [];
        this.initialisePageElements()
        this.pageElements = this.allPageElements;
        // register some handlers
        GameAPI.instance = this;
        // Store bound listeners
        this.boundOnNewQuestion = (event) => {
            window.location.reload(true);
        };
        this.boundOnQuestionTimeout = (event) => {
            window.location.reload(true);
        };
        // Add listeners
        window.addEventListener('questionChanged', this.boundOnNewQuestion);
        window.addEventListener('questionTimedOut', this.boundOnQuestionTimeout);
        // start polling
        this.startPolling();
    }

    /**
     * instantiates page elements.
     * PageElements are classes that handle dom objects and
     * how they are displayed on a page. Not all Page elements
     * will be displayed on any one page, but they are all instantiated
     * and code elsewhere will determine which elements are important
     */
    initialisePageElements() {
        // Move page element initialization to separate method
        this.allPageElements.push(new QuestionView());
        this.allPageElements.push(new ClickMap());
        this.allPageElements.push(new FreeText());
        this.allPageElements.push(new MultiChoice());
        this.allPageElements.push(new StreetView());
        this.allPageElements.push(new GridImage());
        // Initialize buttons
        this.allPageElements.push(new AnswerButton());
        this.allPageElements.push(new NextQuestionButton());
        this.allPageElements.push(new PreviousQuestionButton());
        this.allPageElements.push(new StartQuestionButton());
        this.allPageElements.push(new StopQuestionButton());
        this.allPageElements.push(new PauseQuestionButton());
        this.allPageElements.push(new ShowAnswerButton());
        // Initialize the timer
        this.allPageElements.push(new Timer());
        // observer
        this.allPageElements.push(new Leaderboard());
        this.allPageElements.push(new CurrentAnswers());
        // host
        this.allPageElements.push(new PlayerAdmin());
        // player
        this.allPageElements.push(new PlayerMessage());
    }
    /**
     * Returns the singleton instance of this object
     * @returns {GameAPI}
     */
    static getInstance() {
        if (!GameAPI.instance) {
            GameAPI.instance = new GameAPI();
        }
        return GameAPI.instance;
    }

    /**
     * returns the 'state' field of the instance
     * which represents the current state of the game
     * has elements such as Questions etc.
     * @returns {Object} the json object representing the current game state
     */
    static getGameState() {
        return GameAPI.getInstance().state;
    }

    /**
     * Fetches the current leaderboard data from the server
     * @returns {object|null} Leaderboard data or null if the request fails
     */
    async fetchLeaderboard() {
        try {
            const response = await fetch('/api/get-leaderboard', {
                method: 'GET',
                credentials: 'include' // Include cookies for session handling
            });
            if (!response.ok) {return null;}
            const leaderboardData = await response.json();
            if (!leaderboardData) {
                this.info("failed to get leaderboard data");
                return null;
            }
            return this.leaderboard = leaderboardData;
        } catch (error) {
            this.warn('Error fetching leaderboard:', error);
            return null;
        }
    }


    /**
     * gets the current game state from the server api
     * handles server outage etc.
     * @returns {object} or null if the game state could not be got
     */
    async fetchGameState() {
        try {
            const response = await fetch('/api/game-state').catch(error => {return { ok: false };});
            if (!response.ok) {
                this.failureCount++;
                console.warn(`Failed to get game state ${this.failureCount} times`);
                if (this.failureCount >= this.maxFailures) {
                    console.warn(`Stopping polls after ${this.maxFailures} failures`);
                    this.stopPolling();
                }
                return null;
            }
            // Reset failure count on success
            this.failureCount = 0;
            const newState = await response.json();
            if (!newState) {throw new Error("Failed to parse game state");}
            return newState;
        } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.maxFailures) {
                this.stopPolling();
            }
        }
        return null;
    }

    /**
     * Updates the current data held in this.state and window.gameState
     * which is accessible via GameAPI.getGameState()
     * This data represents the current state of the game as returned
     * from the server /api as a JSON object
     * This method is polled every N seconds.
     * @returns {void}
     */
    async update() {
        try {
            // get new game state from the server
            let newState = await this.fetchGameState();
            // if important things are missing we're not ready yet
            if (!newState || !newState.currentUser) {
                console.warn('Failed to get game state or current user');
                return;
            }
            // otherwise update everything
            this.state = newState;
            this.currentUser = newState.currentUser;
            window.gameState = newState;
            // update the local question cache
            this.setCurrentQuestion(newState.currentQuestion);
            // update the local timer countdown cacheed number
            this.setTimeLeft(newState.currentQuestion.timeLeft);
            // update any 'PageElement' objects and update them on each poll
            for (let pe of this.pageElements) {
                pe.update(this);
            }
            // fire an event in case anythiing is listening
            window.dispatchEvent(new CustomEvent('gameStateUpdated', {
                detail: newState
            }));
        } catch (error) {
            console.error('Error updating game state:', error);
            this.failureCount++;
            if (this.failureCount >= this.maxFailures) {
                this.stopPolling();
            }
        }
    }

    /**
     *
     * @returns {boolean} true if the user has a sessoin on the remote server
     */
    async checkLoggedIn() {
        try {
            const response = await fetch('/api/session', {
                method: 'GET',
                credentials: 'include' // This ensures cookies are sent with the request
            });
            if (!response.ok) {return false;}
            const data = await response.json();
            return data.isLoggedIn;
        } catch (error) {
            console.error('Session check failed:', error);
            return false;
        }
    }

    assertLoggedIn() {
        const isLoggedIn = this.checkLoggedIn();
        if (!isLoggedIn) {
            window.location.href = '/join';
            return false;
        }
        return true;
    }

    // Add this new method to GameAPI class
    showServerUnavailablePage() {
        // Create an entirely new document content
        if (1==1) {return;}
        document.documentElement.innerHTML = `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Server Not Available</title>
                </head>
                <body style="
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                    font-family: Arial, sans-serif;
                ">
                    <div style="
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        text-align: center;
                        background-color: white;
                        padding: 2rem;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    ">
                        <h2>Server not available</h2>
                        <p>The game server is currently unreachable.</p>
                        <button onclick="window.location.href='/join'" style="
                            padding: 10px 20px;
                            font-size: 16px;
                            cursor: pointer;
                            background-color: #007bff;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            transition: background-color 0.2s;
                        ">Rejoin Game</button>
                    </div>
                </body>
            </html>
        `;
    }

    /**
     * If the current question is counting down it is active, false otherwise
     * @returns {boolean} true if the current question is active
     */
    isQuestionActive() {
        let t = this.getTimeLeft();
        if (t > 0) {return true;}
        return false;
    }
    /**
     * Sets the cached value of 'timeLeft' which is the countdown
     * of time which the user has left to answer this question
     * Fires questionTimedOut when the timeLeft reaches zero
     * @param {number} t
     * @returns {void}
     */
    async setTimeLeft(t) {
        if (!t || typeof t !== 'number' || isNaN(t) || t < 0) {
            this.timeLeft = 0;
        } else {
            this.timeLeft = t;
        }

        if (this.timeLeft <= 0) {
            if (this.previousTimeLeft > 0) {
                this.timeLeft = 0;
                window.dispatchEvent(new CustomEvent('questionTimedOut', {
                    detail: this.currentQuestion
                }));
            }
        } else {
            this.timeLeft = t;
            console.info(`Timer : ${this.timeLeft}`);
        }
        this.previousTimeLeft = this.timeLeft;
    }
    /**
     * If the current question is counting down then this
     * will return the time that remains to answer the question
     * @returns {number} the time left to answer the question
     */
    getTimeLeft() {
        if (!this.timeLeft || this.timeLeft < 0) {this.timeLeft = 0;}
        return this.timeLeft;
    }
    /**
     * A map of the currently signed in players
     * @returns {map[string]Player} a map of players matching that in game.go
     */
    getPlayers() {
        // first check if we have this member variable
        let s = GameAPI.getGameState();
        // try the dom
        if (!s) {s = window.gameState}
        // ok error!
        if (!s) {return null;}
        if (!s.players) {return null;}
        return s.players;
    }

    isShowAnswer() {
        // first check if we have this member variable
        let s = GameAPI.getGameState();
        // try the dom
        if (!s) {s = window.gameState}
        // ok error!
        if (!s) {return null;}
        if (!s.IsShowAnswer) {return false;}
        return s.IsShowAnswer
    }
    /**
     * Gets the currently logged in user
     * @returns the current user
     */
    getCurrentPlayer() {
        // first check if we have this member variable
        let s = GameAPI.getGameState();
        if (!s.currentUser) {return null;}
        return s.currentUser;
    }

    /**
     * @returns {boolean} True if the currently logged in player has Host status
     */
    isHost() {
        let cp = this.getCurrentPlayer();
        if (!cp) {return false;}
        return cp.isAdmin;
    }
    /**
     * caches the question passed in the memeber varables of this object
     * if the question number differs from that of the previous cached value
     * fires the question changed event.
     * @param {Question} question
     * @returns {void}
     */
    async setCurrentQuestion(question) {
        // fire questionChanged if necessary
        if (this.currentQuestion) {
            if (this.currentQuestion.questionNumber !== question.questionNumber) {
                this.currentQuestion = question;
                // Reduce the size of the array based on whether page elements exist
                this.pageElements = this.allPageElements.filter(pe => pe.doShouldShow());
                window.dispatchEvent(new CustomEvent('questionChanged', {detail: question}));
                return;
            }
        }
        // make sure we always update the current question in case
        // some of its fields have been changed at the server end
        this.currentQuestion = question;
    }
    /**
     * returns the current question if it is set, null otherwise
     */
    getCurrentQuestion() {
        if (!this.currentQuestion) {
            console.warn("this.currentQuestion is null");
            return null;
        }
        return this.currentQuestion;
    }
    /**
     * compares two string arrays agnostic to position
     * that is, if the arrays contain exactly the same elements
     * regardless of order then the response is true, false otherwise
     * @param {array{string}} f
     * @param {array{string}} s
     * @returns {boolean}
     */
    compareArrays(f, s) {
        if (!f && !s) {return true;}
        if (!f || !s) {return false;}
        if (f.length !== s.length) {return false;}
        for (let i = 0; i < f.length; i++) {
            if (!s.includes(f[i])) {return false;}
        }
        return true;
    }
    /**
     * Returns any answers which have been submitted on the
     * current question
     * @returns Answer[]
     */
    getCurrentAnswers() {
        let cq = this.getCurrentQuestion()
        if (!cq) {return;}
        let answers = cq.answers;
        if (!answers) {return;}
        return answers;
    }
    /**
     * Returns true if the answers on the current question has a length
     * greater than zero
     * @returns bool true if any user has answered this question yet
     */
    hasAnyoneAnswered() {
        let cq = this.getCurrentQuestion();
        if (!cq) {return false;}
        let answers = cq.answers;
        if (!answers) {return false;}
        return answers.length > 0;
    }

    /**
     * returns the answer object submitted by the current player for the current questions
     * @returns {object} the answer object submitted by the current player for the current questions
     */
    getCurrentAnswer() {
        //return true if the current user has answered the current question
        let cq = this.getCurrentQuestion();
        if (!cq) {return null;}
        let answers = cq.answers;
        if (!answers) {return null;}
        let currentUser = this.getCurrentPlayer();
        if (!currentUser) {return null;}
        let username = currentUser.username;
        if (!username) {return null;}
        for (let a of answers) {
            if (a.username === username) {
                return a;
            }
        }
        return null;
    }

    /**
     * returns true if the current user has answered the current question
     * @returns {boolean} true if the current user has answered the current question
     */
    hasAnswered() {
        let a = this.getCurrentAnswer()
        if (!a) {return false;}
        return true;
    }

    startPolling(interval = 2000) { // Poll every 2 seconds by default
        this.stopPolling(); // Clear any existing interval
        // do an initial update to avoid interval delay in page update
        this.update()
        this.pollInterval = setInterval(() => this.update(), interval);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);g
            this.pollInterval = null;
        }
    }

    /**
     * @returns an answer object matching that defined in game.go
     */
    createAnswerObject() {
        let cq = this.getCurrentQuestion();
        // TODO populate username and question number
        let answer = {
            "questionNumber": cq.questionNumber,
            "username": this.getCurrentPlayer()?.username ?? null,
            "answer": "...",
            "comment": "timeout",
            "points": 0,
        };
        return answer;
    }
    /**
     * Handles the user pressing the white flag button
     * @returns {null}
     */
    async surrender() {
        try {
            let points = 0;
            let username = this.getCurrentPlayer()?.username ?? null;
            GameAPI.sendHttpRequest(`/api/players?username=${username}&action=surrender&points=${points}`);

            const event = new CustomEvent('answerSubmitted', {
                bubbles: true,
                detail: {
                    timestamp: Date.now()
                }
            });
            window.dispatchEvent(event);
            this.update();
        } catch (error) {
            console.warn('Failed to submit answer:', error);
            return false;
        }
    }

    getAnswerComponent() {
        let cq = this.getCurrentQuestion()
        // work out what and where the answer is based on
        // what the current question is
        let questionType = cq?.type ?? 'unknown';
        // Find the appropriate page element for this question type
        let answerComponent = this.allPageElements.find(element => {
            switch(questionType) {
                case 'kazakhstan':
                case 'geolocation':
                    return element instanceof ClickMap;
                case 'multichoice':
                    return element instanceof MultiChoice;
                case 'freetext':
                    return element instanceof FreeText;
                case 'gridimage':
                    return element instanceof GridImage;
                default:
                    return null;
            }
        });
        return answerComponent;
    }


    /**
     * Submits the answer object to the server
     * @returns {boolean} true if the answer was accepted, false otherwise
     */
    async submitAnswer() {
        let cq = this.getCurrentQuestion()
        if (!this.isQuestionActive()) {
            return false;
        }

        // Find the appropriate page element for this question type
        let answerComponent = this.getAnswerComponent();

        if (!answerComponent) {
            console.warn("Could not find appropriate component for question type:", questionType);
            return false;
        }

        let answer = answerComponent.doGetAnswer();

        if (!answer || answer === "") {
            this.sendSelfMessage("you must submit choose an answer", 10);
            return false;
        }

        try {
            let s = JSON.stringify(answer);
            const response = await fetch('/api/submit-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: s
            });
            if (!response.ok) {
                console.warn('Server returned error when submitting answer:', response.status);
                return false;
            }
            const event = new CustomEvent('answerSubmitted', {
                bubbles: true,
                detail: {
                    timestamp: Date.now()
                }
            });
            window.dispatchEvent(event);
            this.update();
        } catch (error) {
            console.warn('Failed to submit answer:', error);
            return false;
        }
        return true;
    }
    /**
     * removes a player from the players list by
     * calling the API and asking for a removal
     * this will log the user out of the game.
     * It is also possible to ban the user (prevent
     * re-login) altogether by IP address if necessary
     * @param {string} playerName
     */
    async removePlayer(playerName) {
        try {
            const response = await fetch('/api/remove-player', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player: playerName })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.update();
        } catch (error) {
            console.error('Failed to remove player:', error);
        }
    }

    /**
     * loads an image synchronously by calling await decode()
     * @param {*} url
     * @returns {object} an image object
     */
    static async getImage(url) {
        if (!url) {return;}
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            document.body.appendChild(img);
            const p = document.createElement("p");
            p.textContent = "Image is fully loaded!";
            return img;
        } catch (error) {
            console.error('Error loading image:', error);
            return null;
        }
    }

    getFileContent(filePath) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', filePath, false);
        try {
            xhr.send();
            if (xhr.status !== 200) {
                console.error('Failed to load file:', xhr.statusText);
                return null;
            }
            return  xhr.responseText;
        } catch (error) {
            console.error('Error loading file:', error);
            return null;
        }
    }

    /**
     * Uses the API to send a message to the named user
     * @param {*} username the name of the user that should recieve the message
     * @param {*} message The content of the message
     * @param {*} duration The amount of seconds that the message should remain displayed
     */
    static async sendMessage(username, message, duration) {
        // TODO pass duration through
        const encodedUsername = encodeURIComponent(username);
        const encodedMessage = encodeURIComponent(message);
        const url = `/api/players?username=${encodedUsername}&action=msg&points=${encodedMessage}`;
        GameAPI.sendHttpRequest(url);
    }
    /**
     * sends an api call to the server which will enable
     * a message for this (current) user and manage the message
     * lifecycle
     * @param {string} message the message to display
     * @param {int} duration the duration of the message in seconds
     */
    async sendSelfMessage(message, duration) {
        if (!message || !duration) {return;}
        let c = this.getCurrentPlayer();
        if (!c) {return;}
        if (!c.username) {return;}
        GameAPI.sendMessage(c.username, message, duration)
    }

    /**
     * Makes http requests using XMLHttpRequest
     * @param {*} url
     * @returns the body text of the http response or null
     */
    static async sendHttpRequest(url) {
        const xhr = new XMLHttpRequest();
        const encUrl = encodeURI(url)
        xhr.open('GET', encUrl, false);
        try {
            xhr.send();
            if (xhr.status !== 200) {
                console.error('Failed to submit api request', xhr.statusText);
                return null;
            }
            return xhr.responseText;
        } catch (error) {
            console.error('error submitting api request:', error);
            return null;
        }
    }
}