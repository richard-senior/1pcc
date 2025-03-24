/**
 * Singleton class which manages interaction with the server API
 * Timout without everyone answering prevents question table from showing`
 * Make sure users cannot re-submit questions or re-select anything
 * Flags games
 * Connecting wall
 */
class GameAPI {

    constructor() {
        if (GameAPI.instance) {return GameAPI.instance;}
        this.timeLeft = 0;
        this.previousTimeLeft = 0;
        this.state = null;
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
        // Initialize buttons
        this.allPageElements.push(new AnswerButton());
        this.allPageElements.push(new NextQuestionButton());
        this.allPageElements.push(new PreviousQuestionButton());
        this.allPageElements.push(new StartQuestionButton());
        this.allPageElements.push(new StopQuestionButton());
        this.allPageElements.push(new PauseQuestionButton());
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
     * the percentage of time currently used by the user without submitting an
     * answer. Used to add penalisation to points scored etc.
     * @returns {float} the percentage of time the user has used so far
     */
    getPercentageTimeUsed() {
        let tl = this.getTimeLeft();
        if (!tl || tl <= 0) {return 100.0;}
        let cq = this.getCurrentQuestion();
        let ret = (tl / cq.timeLimit) * 100.0;
        return ret;
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
            }
        } else {
            this.currentQuestion = question;
        }
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
            "answer": null,
            "comment": null,
            "points": null,
        };
        return answer;
    }
    /**
     * Handles the user pressing the white flag button
     * @returns {null}
     */
    async surrender() {
        if (!this.isQuestionActive()) {return;}
        let answer = this.createAnswerObject();
        answer.answer = "..."
        answer.comment = "forfeit"
        answer.points = 0;

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
                return;
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
     * Submits the answer object to the server
     * @returns {boolean} true if the answer was accepted, false otherwise
     */
    async submitAnswer() {
        let cq = this.getCurrentQuestion()
        if (!this.isQuestionActive()) {
            return false;
        }

        // work out what and where the answer is based on
        // what the current question is
        let questionType = cq?.type ?? 'unknown';

        // Find the appropriate page element for this question type
        let answerComponent = this.allPageElements.find(element => {
            switch(questionType) {
                case 'khazakstan':
                case 'geolocation':
                    return element instanceof ClickMap;
                case 'multichoice':
                    return element instanceof MultiChoice;
                case 'freetext':
                    return element instanceof FreeText;
                default:
                    return false;
            }
        });

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

// *******************************
// ************ PAGE ELEMENT *****
// *******************************
/**
 * The base type of all page elements
 * A page Elment is an object that manages the content
 * style and visibility of a dom element
 * This object should be implemented by extending classes
 * in order to manage different elements of the page
 * Implements a sort of state management system siliar like frameworks
 * such as React but vastly simplified.
 */
class PageElement {
    constructor(name, questionTypes) {
        // event bindings
        this.boundOnNewQuestion = null;
        this.boundOnQuestionTimeout = null;
        this.boundOnAnswerSubmitted = null;
        // general
        this.classname = this.constructor.name;
        this.element = null;
        this.styles = null;
        this.name = name;
        this.styleId = name + '-style';
        this.questionTypes = null;
        if (questionTypes) {
            if (Array.isArray(questionTypes)) {
                this.questionTypes = questionTypes;
            } else if (typeof questionTypes === 'string') {
                this.questionTypes = [questionTypes];
            }
        }
        this.initialisedHasRun = false;
        this.selectedAnswer = null;
        this.answerSubmitted = false;
    }

    /**
     * called during 'update' after complete construction of both
     * this page element and the game API itself.
     * Safe to use as a kind of secondary constructor which won't cause
     * stack overflows etc.
     * @param {*} api
     * @returns null
     */
    doInitialise(api) {
        if (this.initialisedHasRun) {return;}
        let ca = api.getCurrentAnswer();
        if (ca) {
            this.selectedAnswer = ca;
        }
        this.initialise(api);
        this.initialisedHasRun = true;
        //this.initialiseEvents();
    }

    /**
     * Should be overriden to init anything in page elements that requires a
     * fully instantiated game state
     * @param {*} api the game state api
     */
    initialise(api) {}

    /**
     * Init various event handlers
     */
    initialiseEvents() {

        this.boundOnAnswerSubmitted = async (event) => {
            try {
                await this.onAnswerSubmitted(event);
            } catch (error) {
                console.warn(`Error in onAnswerSubmitted for ${this.constructor.name}:`, error);
            }
        };

        this.boundOnNewQuestion = async (event) => {
            try {
                await this.onNewQuestion(event);
            } catch (error) {
                console.warn(`Error in onNewQuestion for ${this.constructor.name}:`, error);
            }
        };

        this.boundOnQuestionTimeout = async (event) => {
            try {
                await this.onQuestionEnd(event);
            } catch (error) {
                console.warn(`Error in onQuestionEnd for ${this.constructor.name}:`, error);
            }
        };

        // Add event listeners
        window.addEventListener('answerSubmitted', this.boundOnAnswerSubmitted);
        window.addEventListener('questionChanged', this.boundOnNewQuestion);
        window.addEventListener('questionTimedOut', this.boundOnQuestionTimeout);
    }

    async onAnswerSubmitted(event) {
        // Base implementation does nothing
        return Promise.resolve();
    }

    /**
     * Base method for handling new question events
     * Extending classes should override this method using async/await pattern
     * @param {CustomEvent} event The question changed event
     */
    async onNewQuestion(event) {
        // Base implementation does nothing
        return Promise.resolve();
    }

    /**
     * Base method for handling question end events
     * Extending classes should override this method using async/await pattern
     * @param {CustomEvent} event The question timeout event
     */
    async onQuestionEnd(event) {
        // Base implementation does nothing
        return Promise.resolve();
    }

    /**
     * Finds the dom element managed by this object in the current
     * dom model, or creates and inserts it.
     * Once found or created, caches it locally to prevent constant
     * dom searches
     * @returns {Document.Object} the dom element that this object manages
     */
    getElement() {
        if (this.element) {return this.element;}
        let pe = document.getElementById(this.name);
        if (pe) {
            this.element = pe;
            return pe;
        }
        pe = this.createElement();
        if (pe) {
            this.element = pe;
            return pe;
        }
        this.element = null;
    }
    /**
     * Abstract method that should be overriden by the extending class
     * called when the dom element managed by this object doesn't already
     * exist in the page. Creates and inserts the dom element in the correct
     * page of the dom model
     * @returns {void}
     */
    createElement() { return null;}
    /**
     * Convenience method for getting the GameAPI instance
     * @returns {GameAPI} the GameAPI instance
     */
    getApi() {return GameAPI.getInstance();}
    /**
     * Convenience method for getting the current game state
     * @returns {Object} the current game state
     */
    getGameState() {return GameAPI.getGameState();}
    /**
     * Convenience method for getting the current Question object
     * from the game state
     * @returns {Question} the current question object
     */
    getCurrentQuestion() {return this.getApi().getCurrentQuestion();}
    /**
     * returns whatever answer the user entered for this question or null
     * @returns {object} the answer object or null
     */
    getCurrentAnswer() {return this.getApi().getCurrentAnswer();}
    /**
     * Convenience method for getting response from game state
     * @returns {boolean} the current GameAPI instance isQustionActive respnose
     */
    isQuestionActive() {
        let a = this.getApi()
        return a.isQuestionActive()
    }
    /**
     * Returns the current countdown time
     * which is the time remaining to answer the question
     * @returns {number} the current time remaining in seconds
     */
    getTimeLeft() {
        let a = this.getApi();
        return a.getTimeLeft();
    }
    /**
     * Returns the user object
     * @returns {object} the current player object
     */
    getCurrentPlayer() {return this.getApi().getCurrentPlayer();}
    /**
     * Concenience method for getting the current players map
     * @returns {Players} the current players map
     */
    getPlayers() {return this.getApi().getPlayers();}
    /**
     * By default will return true if the current question is
     * counting down. False otherwise.
     * May be overriden to provide different hueristics.
     * Used almost exclusively by AnimatedButton objects which extend this
     * class but has been placed here in case other page elements need it
     * @returns {boolean} true if this page element is enabled
     */
    isEnabled() {
        let ret = this.isQuestionActive();
        return ret;
    }
    /**
     * returns true if the dom element that this object manages should be
     * updated. First checks
     * 1) dom element exists (returns false if not)
     * 2) current question exists (returns false if not)
     * 3) this object should even be shown on the page
     * finally calls shouldUpdate which can be overriden by the extending class
     * @returns {boolean} true if this object should update the dom element it manages
     */
    doShouldUpdate() {
        if (!this.getElement()) {
            return false;
        }
        if (!this.doShouldShow()) {
            return false;
        }
        if (!this.shouldUpdate()) {
            return false;
        }
        return true
    }
    /**
     *
     * Method intended to be overriden by the extending class
     * Allows the extending class to add logic determining whether
     * the dom element managed by this object should be updated
     * @returns {boolean} default true
     */
    shouldUpdate() {return true;}
    /**
     * Buffers the update of the dom element managed by this object
     * Calls getContent to get the new content of the dom element
     * then calls applyUpdate to actually update the main dom element
     * @param {GameAPI} gameState the current GameAPI
     * @returns {void}
     */
    update(api) {
        let cn = this.constructor.name
        this.doInitialise(api);
        if (!this.doShouldUpdate()) {
            return;
        }
        this.getStyles();
        let o = this.getContent(api)
        this.applyUpdate(o);
    }
    /**
     * Uses animation frame to replace the content of the managed
     * element without flickering etc.
     * @param {Document.Object} content a page element or elements
     * @returns {void}
     */
    applyUpdate(content) {
        let cn = this.constructor.name;
        if (!content) {return;}
        const element = this.getElement();
        if (!element) return;
        requestAnimationFrame(() => {
            if (Array.isArray(content) || content instanceof NodeList) {
                element.replaceChildren(...content);
            } else if (content instanceof Node) {
                element.replaceChildren(content);
            } else if (content) {
                console.error('Invalid content type:', content);
            }
        });
    }
    /**
     * Should be overriden by the extending class to return
     * new dom elements which should replace the existing dom elements
     * inside the main dom element managed by this object
     * Can be ignored if applyUpdate is overriden and performs page manipulation
     * directly
     * @param {GameAPI} gameState the current GameAPI
     * @returns {Document.Object} a dom object or objects to be placed into the managed page element
     */
    getContent(api) {}
    /**
     * Calls createStyles to create any css styles required
     * buy the dom object managed by this object.
     * Once createStyles has run, the response is cached locally
     * so that the dom doesn't get repeatedly searched.
     * If you wish to do something dynamic with styles you can
     * set this.styles=null and createStyles will be re-called
     * Can be overriden by extending classes to do some other sort
     * of CSS manipulation (differently named css classes etc.)
     * @returns {void}
     */
    getStyles() {
        if (this.styles) {return;}
        const existingStyle = document.getElementById(this.styleId);
        if (existingStyle) {
            this.styles = existingStyle;
            return;
        }
        const se = document.createElement('style');
        // name the style so that we don't re-apply it
        se.id = this.styleId;

        let css = this.createStyles();

        if (!css) {
            this.styles = 'nostyles';
            return;
        }
        se.innerHTML = css;
        this.styles = se;
        document.head.appendChild(se);
    }
    /**
     * should be overriden to return the CSS markup required by this dom element
     * If no particular styles are required just don't implement the method or
     * return null from your implementation
     * If you're using CSS in the main.css stylesheet then don't impleent this method
     * instead implement getStyles as:
     * - getStyles() {}
     * This will save a little time
     * @returns {string} containing CSS markup
     */
    createStyles() {return null;}
    /**
     * checks fields in the question to determine if this page element
     * is relevant. For example if this is not a multichoice question then
     * then any page element dealing with multichoice questions is not appropriate
     * @param {*} q
     * @returns {boolean} true this page element is appropriate for the given question
     */
    isCompatibleWithQuestion(cq) {
        if (!cq || !cq.type) {
            console.warn("no question.. can't continue")
            this.hide();
            return false;
        }
        let t = cq.type
        if (!t) {
            console.warn("question doesn't have a type");
            this.hide()
            return false;
        }
        let qt = this.questionTypes
        if (!qt || !Array.isArray(qt)) {
            console.warn("no question types")
            this.hide()
            return false;
        }
        // Check if this PageElement supports the current game type
        // this is non-negotiable
        if (!qt.includes("*")) {
            if (!qt.includes(cq.type)) {
                this.hide();
                return false;
            }
        }
        //console.log(`${qt} is compatible with ${cq.type}`)
        return true
    }

    /**
     * hides or shows the dom element managed by this object
     * based on some logic.
     * 1) The element is present in the dom
     * 2) the current question is not none
     * 3) this.shouldShow returns true or false
     *
     * @returns {boolean} true if the managed element should be shown
     */
    doShouldShow() {
        if (!this.getElement()) {return false;}
        let cq = this.getCurrentQuestion();
        if (!this.isCompatibleWithQuestion(cq)) {return false;}
        // let the extending class have the final say
        let ss = this.shouldShow();
        if (ss) {
            this.show();
            return true;
        } else {
            this.hide();
            return false;
        }
    }

    /**
    * returns true if the question has been answered or if the answer
    * has been recently submitted
    * @returns {boolean} true if the current question has been answered
    */
    hasAnswered() {
        if (this.selectedAnswer && this.answerSubmitted) {return true;}
        const g = this.getApi();
        if (g.hasAnswered()) {
            this.answerSubmitted = true;
            return true;
        }
        this.answerSubmitted = false;
        return false;
    }

    /**
     * @returns {Answer}
     */
    doGetAnswer() {
        if (this.selectedAnswer) {return this.selectedAnswer;}
        this.selectedAnswer = this.getAnswer();
        if (this.selectedAnswer) {
            this.answerSubmitted = true;
        }
        if (this.selectedAnswer.points && this.selectedAnswer.points>0) {
            // now add small penalty for time taken?
            let ptu = this.getApi().getPercentageTimeUsed()
            let timeMultiplier = 1 - (0.1 * (1 - Math.exp(-3 * (ptu / 100))));
            // Calculate original points and penalty
            let originalPoints = this.selectedAnswer.points;
            let penalizedPoints = Math.round(originalPoints * timeMultiplier);
            // Apply the penalty
            this.selectedAnswer.points = penalizedPoints;
        }
        return this.selectedAnswer;
    }

    /**
     * Should be overriden to return the answer to the current question
     * as submitted by the user
     * @returns {Answer}
     */
    getAnswer() {return null;}
    /**
     * Should be overriden to determine if this dom element should
     * be hidden or shown based on some logic. Default true
     * @returns {boolean} true if the dom element should be visible
     */
    shouldShow() {return true;}
    /**
     * sets the managed page elements style visibility and
     * display parameters such that the element is shown
     * @returns {void}
     */
    show() {
        let el = this.getElement();
        if (!el) {
            console.warn(`Element ${this.name} not found in DOM`);
            return;
        }
        el.style.visibility = 'visible';
        el.style.display = 'block';
    }

    /**
     * sets the managed page elements style visibility and
     * display parameters such that the element is hidden
     * @returns {void}
     */
    hide() {
        let el = this.getElement();
        if (!el) {
            console.warn(`Element ${this.name} not found in DOM`);
            return;
        }
        el.style.visibility = 'hidden';
        el.style.display = 'none';
    }
}

// ###################################################################
// QUESTION
// ###################################################################
/**
 * On question ended, shows information about how the player should have answered
 */
class ProveAnswerView extends PageElement {
}
/**
 * PageElement which manages the display of the actual question
 * that is the text or otherwise which prompts the player for a response
 */
class QuestionView extends PageElement {
    constructor() {
        super('question-title', ['*'])
        this.questionNumber = -1;
    }

    shouldUpdate() {
        let cq = this.getCurrentQuestion();
        if (cq.questionNumber !== this.questionNumber) {
            this.questionNumber = cq.questionNumber;
            return true;
        }
        return false;
    }

    createStyles() {
        return `
            .question-title-container {
                width: 100%;
                border-collapse: collapse;
                background: transparent;
                border: 0;
                position: relative;
            }
            .question-title-container tr,
            .question-title-container td {
                background: transparent;
                border: 0;
                padding: 0;
                text-align: center;
            }
            .corner-image {
                position: absolute;
                top: 0;
                right: 0;
                width: 3em;
                height: 3em;
                z-index: 1000;  /* Increased z-index to ensure it's above other elements */
                cursor: pointer;
                transition: opacity 0.3s ease;  /* Smooth transition for opacity change */
                opacity: 0.6;  /* Initial state slightly transparent */
                pointer-events: auto;  /* Ensure the image receives mouse events */
            }
            .corner-image:hover {
                opacity: 1;  /* Full opacity on hover */
            }
            .username-row {
                color: var(--bcclightgold);
                font-size: 1.2em;
                font-weight: bold;
                position: relative;
                z-index: 2;
            }
            .percent-row {
                color: var(--bccdarkgold);
                font-size: 1.4em;
                font-weight: bold;
                position: relative;
                z-index: 2;
            }
            .question-row {
                color: white;
                font-size: 1.8em;
                position: relative;
                z-index: 2;
            }
        `;
    }

    handleGiveUp() {
        this.getApi().surrender();
    }

    getContent(gs) {
        let cp = this.getCurrentPlayer();
        if (!cp) {return;}
        let cq = this.getCurrentQuestion();
        if (!cq) {return;}

        const container = document.createElement('div');
        container.style.position = 'relative';

        // Create the corner image
        const cornerImage = document.createElement('img');
        cornerImage.src = '/static/images/giveup.svg';
        cornerImage.title = "I give up!";
        cornerImage.className = 'corner-image';

        // Add click event listener
        cornerImage.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleGiveUp();
        });

        container.appendChild(cornerImage);

        // Create table
        const table = document.createElement('table');
        table.className = 'question-title-container';

        // Create username row
        const usernameRow = document.createElement('tr');
        const usernameCell = document.createElement('td');
        usernameCell.className = 'username-row';
        usernameCell.textContent = cp.username;
        usernameRow.appendChild(usernameCell);

        // Create percent row
        const percentRow = document.createElement('tr');
        const percentCell = document.createElement('td');
        percentCell.className = 'percent-row';
        percentCell.textContent = cq.percent.toString() + "% - " + cq.category;
        percentRow.appendChild(percentCell);

        // Create question row
        const questionRow = document.createElement('tr');
        const questionCell = document.createElement('td');
        questionCell.className = 'question-row';
        questionCell.innerHTML = `${cq.question}`;
        questionRow.appendChild(questionCell);

        // Add rows to table
        table.appendChild(usernameRow);
        table.appendChild(percentRow);
        table.appendChild(questionRow);

        container.appendChild(table);

        return container;
    }

}

// ###################################################################
// STREETVIEW
// ###################################################################
/**
 * PageElement that manages the displaying of google streetview for
 * geolocation questions
 */
class StreetView extends PageElement {
    constructor() {
        super('streetview-container', ['geolocation']);
        this.baseUrl = "https://www.google.com/maps/embed?pb=";
        this.container = null;
        this.iframe = null;
        this.url = null;
    }

    /** just speed things up a little */
    createStyles() {}

    shouldUpdate() {
        // if we haven't been instantiated properly yet
        if (!this.url) {return true;}
        // if we have relevant data for this kind of question
        let cq = this.getCurrentQuestion()
        if (!cq || !cq.streetView) {return false;}
        // if we've started a different question
        if (cq.streetView !== this.url) {return true;}
        return false;
    }

    getContent(gs) {
        let cq = this.getCurrentQuestion();
        this.url = cq.streetView;
        const embedUrl = this.baseUrl + this.url;
        this.container = this.getElement();
        // Set container to relative positioning
        this.container.style.position = 'relative';
        // Create and setup iframe with required permissions
        this.iframe = document.createElement('iframe');
        this.iframe.id = 'streetview-iframe'
        this.iframe.class = 'streetview-iframe'
        this.iframe.src = embedUrl;
        this.iframe.allow = "autoplay; picture-in-picture;";
        this.iframe.sandbox = "allow-scripts allow-same-origin";
        this.iframe.allowfullscreen="false"
        this.iframe.loading="lazy"
        this.iframe.referrerpolicy="no-referrer-when-downgrade"
        // Create the semi-transparent blur overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '45vw';
        overlay.style.height = '10vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black
        overlay.style.backdropFilter = 'blur(5px)'; // Add blur effect
        overlay.style.webkitBackdropFilter = 'blur(5px)'; // For Safari support
        overlay.style.zIndex = '1000';
        overlay.style.borderRadius = '4px'; // Optional: rounded corners

        // Clear container and add both elements
        this.container.innerHTML = '';
        this.container.appendChild(this.iframe);
        this.container.appendChild(overlay);
    }
}

// ###################################################################
// CLICKABLE IMAGE
// ###################################################################
/**
 * PageElement that handles the display and input from
 * a map or other clickable image which can return the coordinates
 * on which the user clicked set
 * Used primarily in geolocation questions in which it displays a world map
 */
class ClickMap extends PageElement {

    constructor() {
        super('click-container', ['geolocation','khazakstan'])
        this.answerx = null;
        this.answery = null;
        this.markerSize = 50;
        this.scale = 1;
        this.viewBox = { x: 0, y: 0, width: 1000, height: 500 };
        // mouse
        this.mx = null;
        this.my = null;
        this.prevmx = null;
        this.prevmy = null;
        this.dragx = 0.0;
        this.dragy = 0.0;
        this.isDragging = false;
        //this.hasMoved = false;
        this.clickStartTime = 0;
        this.moveThreshold = 5; // pixels of movement to consider it a drag
        this.clickTimeThreshold = 200; // milliseconds to consider it a click
        this.secondPointerDown = false;
        this.currentMarker = null;
        // dimensions etc
        this.startPoint = { x: 0, y: 0 };
        this.viewBoxStart = { x: 0, y: 0 };
        this.imagePath = null;
        this.svg = null;
        this.imageWidth = null;
        this.imageHeight = null;
        // pinch zooming variables
        this.initialPinchDistance = 0;
        this.initialScale = 1;
        this.lastScale = 1;
        // Initialize events after adding to DOM
        this.initializeEvents();
    }

    createStyles() {
        let css = `
            .click-container {
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                background-color: var(--bccblue);
                margin: 10px, 0;
                border: 1px inset white;
                overflow: hidden;
            }

            .click-container svg {
                display: block;
                pointer-events: all;
                user-select: none;
                -webkit-user-select: none;
            }
        `;
        return css;
    }

    shouldShow() {
        let cq = this.getCurrentQuestion();
        if (!cq || !cq.clickImage) {
            return false;
        }
        return true;
    }

    shouldUpdate() {
        // if we've not been properly instantiated yet
        if (!this.svg) {return true;}
        if (!this.imagePath) {return true;}
        // if we have the relevant quesiton data
        let cq = this.getCurrentQuestion()
        if (!cq.clickImage) {return false;}
        // if this is a new question
        if (cq.clickImage !== this.imagePath) {
            return true;
        }
        return false;
    }

    getContent(gs) {
        let cq = this.getCurrentQuestion();
        this.imagePath = cq.clickImage;
        let rawSvg = this.getApi().getFileContent(this.imagePath);

        if (!rawSvg) {
            console.error('Error: No SVG content loaded');
            return null;
        }

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(rawSvg, 'image/svg+xml');
        const originalSvg = svgDoc.documentElement;

        // Validate that we have a valid SVG
        if (originalSvg.nodeName !== 'svg') {
            console.warn('Error: Invalid SVG document');
            return null;
        }

        // Safely get dimensions with fallbacks
        let width = originalSvg.getAttribute('width');
        let height = originalSvg.getAttribute('height');
        let viewBox = originalSvg.getAttribute('viewBox');

        // Parse viewBox if it exists
        let viewBoxValues = viewBox ? viewBox.split(' ').map(Number) : null;

        // Set dimensions with fallbacks
        this.imageWidth = width ? parseFloat(width) :
                         (viewBoxValues ? viewBoxValues[2] : 800); // default width

        this.imageHeight = height ? parseFloat(height) :
                          (viewBoxValues ? viewBoxValues[3] : 600); // default height

        this.markerSize = Math.round(this.imageWidth / 50);
        // Copy the original SVG
        this.svg = originalSvg;

        // Set SVG to fill container completely
        this.svg.style.width = "100%";
        this.svg.style.height = "100%";
        this.svg.style.display = "block"; // Removes any inline spacing

        // Ensure viewBox exists
        if (!viewBox) {
            this.svg.setAttribute("viewBox", `0 0 ${this.imageWidth} ${this.imageHeight}`);
        }

        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); // Ensures proper scaling

        return this.svg;
    }

    brokenGetContent(gs) {
        if (this.svg) {return this.svg;}
        let cq = this.getCurrentQuestion();
        this.imagePath = cq.clickImage;

        // Create the SVG element
        let svgDoc = document.implementation.createDocument('http://www.w3.org/2000/svg', 'svg', null);
        this.svg = svgDoc.documentElement;

        // Create SVG image element (not HTML image)
        const svgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
        svgImage.setAttribute("href", this.imagePath);  // Use href instead of src
        svgImage.setAttribute("width", "100%");
        svgImage.setAttribute("height", "100%");

        // Set SVG attributes
        this.svg.setAttribute("viewBox", `0 0 ${this.imageWidth} ${this.imageHeight}`);
        this.svg.style.width = "100%";
        this.svg.style.height = "100%";
        this.svg.style.display = "block";
        this.svg.style.visibility = "visible";
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        // Append the SVG image element
        this.svg.appendChild(svgImage);

        // Load the image to get dimensions
        const img = new Image();
        img.onload = () => {
            this.imageWidth = img.naturalWidth;
            this.imageHeight = img.naturalHeight;
            // Update viewBox with actual dimensions
            this.svg.setAttribute("viewBox", `0 0 ${this.imageWidth} ${this.imageHeight}`);
        };
        img.src = this.imagePath;

        return this.svg;
    }

    getAnswer() {
        let gs = GameAPI.getInstance();
        let a = gs.createAnswerObject();
        let cq = gs.getCurrentQuestion();
        let ap = cq.pointsAvailable;

        if (this.answerx === null || this.answery === null) {
            return null;
        }

        // Parse the correct answer coordinates
        const [correctX, correctY] = cq.correctAnswers[0]
            .replace(/\s+/g, '')
            .split(',')
            .map(num => parseFloat(num));

        // Calculate actual distance using Pythagorean theorem
        const dx = this.answerx - correctX;
        const dy = this.answery - correctY;
        const dt = Math.sqrt(dx * dx + dy * dy);
        // this is the pixels to miles ratio
        let miles = Math.round(dt * 3.4);  // Round to nearest whole number
        if (cq.type === "geolocation") {
            a.comment = `${miles} miles off`;
        } else {
            a.comment = `${Math.round(dt)} pixels away`;
        }

        // Calculate maximum possible error from correct point to each corner
        const distanceToCorners = [
            // Top-left corner
            Math.sqrt(
                (correctX - 0) * (correctX - 0) +
                (correctY - 0) * (correctY - 0)
            ),
            // Top-right corner
            Math.sqrt(
                (correctX - this.imageWidth) * (correctX - this.imageWidth) +
                (correctY - 0) * (correctY - 0)
            ),
            // Bottom-left corner
            Math.sqrt(
                (correctX - 0) * (correctX - 0) +
                (correctY - this.imageHeight) * (correctY - this.imageHeight)
            ),
            // Bottom-right corner
            Math.sqrt(
                (correctX - this.imageWidth) * (correctX - this.imageWidth) +
                (correctY - this.imageHeight) * (correctY - this.imageHeight)
            )
        ];

        // Maximum error is the distance to the furthest corner
        const maxError = Math.max(...distanceToCorners);

        // Calculate points based on some non-linear factor of error distance
        // in this case, exponential decay
        let pf = 5.0;
        if (cq.penalisationFactor) {pf = cq.penalisationFactor;}
        const accuracy = Math.exp(-10.0 * dt / maxError);
        a.points = Math.round(ap * accuracy * 10) / 10;

        // Ensure points don't go negative
        if (a.points < 0) a.points = 0.0;
        a.answer = `${this.answerx.toFixed(0)} - ${this.answery.toFixed(0)}`;

        console.info(`Distance: ${dt}, Max Error: ${maxError}, Points: ${a.points}`);
        return a;
    }

    /* Add method to create/update marker
       the image we are working with can be zoomed or dragged
       we want to be able to click on the image and have a marker
       displayed at the click location. the marker not scale with the
       rest of the image when zooming in and out but should remain the
       same size relative to the whole screen.
       Factors at play:
       * this.scale (the current scaling factor)
       * this.dragx and this.dragy (The amount by which the image has been dragged)
       * this.mx, this.my (The current mouse position)
       *
       * dragx is more positive when the image is dragged to the right
       * dragy is more positive when the image is dragged down
       * mx and my are the current mouse position
       * scale is the current scaling factor
       *
       * we need to calculate the position of the marker relative to the image
       * and then scale it up to the size of the image.
    */
    addMarker() {
        let screenX = this.mx;
        let screenY = this.my;

        // Remove existing marker if it exists
        if (this.currentMarker) {
            this.svg.removeChild(this.currentMarker);
        }

        // Get the SVG's current transformation state
        const box = this.svg.viewBox.baseVal;

        // Get SVG's bounding rectangle for coordinate conversion
        const svgRect = this.svg.getBoundingClientRect();

        // Calculate position using the full viewBox dimensions
        const svgX = ((screenX - svgRect.left) / svgRect.width) * box.width + box.x;
        const svgY = ((screenY - svgRect.top) / svgRect.height) * box.height + box.y;

        // Create a circle element
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", svgX);
        circle.setAttribute("cy", svgY);
        // make a note of where we placed the marker
        this.answerx = svgX;
        this.answery = svgY;

        console.info(`marker X: ${this.answerx}, marker Y: ${this.answery}`);

        // Make radius inversely proportional to zoom level
        const zoomAdjustedRadius = this.markerSize / this.scale;
        circle.setAttribute("r", zoomAdjustedRadius);

        circle.setAttribute("fill", "#FFFFFFA0");  // Blue with 50% opacity
        // Store reference to current marker
        this.currentMarker = circle;
        this.svg.appendChild(circle);
    }

    initializeEvents() {
        const container = this.getElement();
        container.style.cursor = 'default';

        // Feature detection for passive support
        let passiveSupported = false;
        try {
            const opts = Object.defineProperty({}, 'passive', {
                get: function() {
                    passiveSupported = true;
                    return true;
                }
            });
            window.addEventListener("test", null, opts);
        } catch (e) {}

        // Set up passive options based on support
        const passiveOpts = passiveSupported ? { passive: true } : false;
        const nonPassiveOpts = { passive: false };

        // MOUSE MOVEMENT HANDLING
        container.addEventListener('mousemove', (e) => {
            if (!this.svg) return;

            // Update mouse position tracking
            this.prevmx = this.mx;
            this.prevmy = this.my;
            this.mx = e.clientX;
            this.my = e.clientY;

            if (this.isDragging) {
                const box = this.svg.viewBox.baseVal;
                const scale = box.width / this.svg.clientWidth;

                // Calculate the movement delta
                const dx = (this.mx - this.prevmx) * scale;
                const dy = (this.my - this.prevmy) * scale;

                // Update viewBox by moving it opposite to the drag direction
                box.x -= dx;
                box.y -= dy;
                this.dragx += dx;
                this.dragy += dy;
            }
        }, nonPassiveOpts);

        // MOUSE EXIT HANDLING
        container.addEventListener('mouseleave', (e) => {
            window.clearInterval();
            if (!this.svg) return;
            this.isDragging = false;
            container.style.cursor = 'default';
        }, passiveOpts);

        // MOUSE UP HANDLING
        container.addEventListener('mouseup', (e) => {
            window.clearInterval();
            if (!this.svg) return;
            container.style.cursor = 'default';
            if (this.isDragging) {
                this.isDragging = false;
            }
        }, passiveOpts);

        // MOUSE DOWN HANDLING
        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!this.svg) return;
            window.clearInterval();
            let tx = e.clientX;
            let ty = e.clientY;
            window.setTimeout(() => {
                const dx = Math.abs(tx - this.mx);
                const dy = Math.abs(ty - this.my);
                if (dx > 1 || dy > 1) {
                    this.isDragging = true;
                    container.style.cursor = 'grabbing';
                } else {
                    this.isDragging = false;
                    container.style.cursor = 'default';
                    this.addMarker();
                }
            }, 350);
        }, nonPassiveOpts);

        // CONTAINER WHEEL ZOOM HANDLING
        container.addEventListener('wheel', (e) => {
            if (this.isDragging) return;
            const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.zoom(scaleFactor, mouseX, mouseY);
        }, passiveOpts);

        // PREVENT CTRL/CMD + WHEEL ZOOM IN CONTAINER
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        }, nonPassiveOpts);

        // TOUCH HANDLING FOR CONTAINER
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.mx = touch.clientX;
                this.my = touch.clientY;
                this.prevmx = this.mx;
                this.prevmy = this.my;
                this.isDragging = false;
                this.clickStartTime = Date.now();

                this.startPoint = {
                    x: touch.clientX,
                    y: touch.clientY
                };
                this.viewBoxStart = {
                    x: this.viewBox.x,
                    y: this.viewBox.y
                };
            } else if (e.touches.length === 2) {
                // Initialize pinch zoom
                this.secondPointerDown = true;
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.initialPinchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                this.initialScale = this.scale;
                this.lastScale = 1;
            }
        }, passiveOpts);

        // TOUCH MOVE HANDLING
        // invokes the existing non-touch handlers such as mousedown etc.
        container.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default touch behaviors

            if (e.touches.length === 1) {
                // Simulate mousedown for single touch
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true
                });
                this.mx = touch.clientX;
                this.my = touch.clientY;
                this.prevmx = this.mx;
                this.prevmy = this.my;
                container.dispatchEvent(mouseEvent);
            }
            else if (e.touches.length === 2) {
                // Store initial distance for pinch zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.initialPinchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
            }
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 1) {
                // Simulate mousemove
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true
                });
                container.dispatchEvent(mouseEvent);
            }
            else if (e.touches.length === 2) {
                // Handle pinch zoom by simulating wheel event
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];

                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );

                // Calculate zoom direction based on pinch movement
                const delta = this.initialPinchDistance - currentDistance;

                // Calculate center point of the pinch
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;

                // Create and dispatch wheel event
                const wheelEvent = new WheelEvent('wheel', {
                    deltaY: delta,
                    clientX: centerX,
                    clientY: centerY,
                    bubbles: true
                });
                container.dispatchEvent(wheelEvent);

                // Update initial distance for next move event
                this.initialPinchDistance = currentDistance;
            }
        }, { passive: false });

        container.addEventListener('touchend', (e) => {
            e.preventDefault();

            // Simulate mouseup
            const mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            container.dispatchEvent(mouseEvent);

            // Reset pinch zoom state
            this.initialPinchDistance = 0;
            this.isDragging = false;
            this.secondPointerDown = false;
        }, { passive: false });

        // POINTER EVENTS FOR PINCH DETECTION
        container.addEventListener('pointerdown', (e) => {
            if (e.isPrimary === false) {
                this.secondPointerDown = true;
            }
        }, passiveOpts);

        container.addEventListener('pointerup', (e) => {
            if (e.isPrimary === false) {
                this.secondPointerDown = false;
            }
        }, passiveOpts);

        // DOCUMENT-LEVEL EVENT HANDLERS
        // Prevent zooming outside of ClickMap etc.
        document.addEventListener('wheel', (e) => {
            if (!e.target.closest('.click-container') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
            }
        }, {
            passive: false,
            capture: true
        });

        // Prevent pinch zoom at document level except for click-container
        document.addEventListener('touchmove', (e) => {
            if (!e.target.closest('.click-container') && e.touches.length > 1) {
                e.preventDefault();
            }
        }, {
            passive: false,
            capture: true
        });

        // Prevent keyboard zoom shortcuts except when click-container is focused
        document.addEventListener('keydown', (e) => {
            if (!e.target.closest('.click-container') && (e.ctrlKey || e.metaKey)) {
                switch (e.key) {
                    case '+':
                    case '-':
                    case '=':
                    case '0':
                        e.preventDefault();
                        break;
                }
            }
        });

        // For wheel events that need preventDefault
        document.addEventListener('wheel', function(e) {
            // Only prevent Ctrl+wheel zoom outside of click-container
            if (!e.target.closest('.click-container') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
            }
        }, {
            passive: false,  // Explicitly set non-passive due to preventDefault() usage
            capture: true   // Use capture to handle event before it reaches other listeners
        });

        // For general wheel events that don't need preventDefault
        document.addEventListener('wheel', function(e) {
            if (e.target.closest('.click-container')) {
                // Handle click-container wheel events normally
                return;
            }
        }, {
            passive: true   // This one can be passive as it never calls preventDefault
        });

        // Prevent pinch zoom at document level EXCEPT for click-container
        document.addEventListener('touchmove', function(e) {
            // Allow the event if it's from the click-container
            if (e.target.closest('.click-container')) {
                return;
            }
            // Prevent pinch zoom everywhere else
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, {
            passive: false,  // Must be non-passive since we use preventDefault
            capture: true
        });

        // Prevent keyboard zoom shortcuts EXCEPT when click-container is focused
        document.addEventListener('keydown', function(e) {
            // Allow if the click-container or its children are focused
            if (e.target.closest('.click-container')) {
                return;
            }
            // Prevent Ctrl/Cmd + Plus/Minus/Zero
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '+':
                    case '-':
                    case '=':
                    case '0':
                        e.preventDefault();
                        break;
                }
            }
        });
        // Prevent zooming with more than one finger
        document.addEventListener('touchstart', function(e) {
            if (e.touches.length > 1) {
                e.preventDefault(); // Prevent zoom
            }
        }, { passive: false });

        // Prevent pinch zooming with gestures
        document.addEventListener('gesturestart', function(e) {
            e.preventDefault(); // Prevent zoom gesture
        }, { passive: false });
    }

    zoom(scaleFactor, centerX, centerY) {
        if (!this.svg) {
            console.error('SVG element not initialized');
            return;
        }

        const newScale = this.scale * scaleFactor;

        // Limit zoom levels but allow zooming out to original size
        if (newScale < 1.0 || newScale > 15) return;

        // Get the current viewBox
        const box = this.svg.viewBox.baseVal;

        // Get SVG's bounding rectangle for coordinate conversion
        const svgRect = this.svg.getBoundingClientRect();

        // Calculate the point around which we're zooming (relative to viewBox)
        const centerPtX = (centerX / svgRect.width) * box.width + box.x;
        const centerPtY = (centerY / svgRect.height) * box.height + box.y;

        // Calculate new dimensions
        const newWidth = this.imageWidth / newScale;
        const newHeight = this.imageHeight / newScale;

        // Calculate new position to keep the center point at the same relative position
        box.x = centerPtX - (centerX / svgRect.width) * newWidth;
        box.y = centerPtY - (centerY / svgRect.height) * newHeight;
        box.width = newWidth;
        box.height = newHeight;

        // Update scale
        this.scale = newScale;

        // Adjust existing marker size if it exists
        if (this.currentMarker) {
            const zoomAdjustedRadius = this.markerSize / this.scale;
            this.currentMarker.setAttribute("r", zoomAdjustedRadius);
        }

        // Update the viewBox object
        this.viewBox = {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height
        };
    }
}
// ###################################################################
// LEADERBOARD
// ###################################################################
/**
 * Class which handle showing the observer who has answered
 * and what they scored for the current question
 */
class CurrentAnswers extends PageElement {
    constructor() {
        super('current-answers-div', ['*']);
    }

    shouldShow() {
        const api = this.getApi();
        if (!api) {
            console.warn('CurrentAnswers: Could not get GameAPI instance');
            return false;
        }
        return api.hasAnyoneAnswered();
    }

    createStyles() {}

    getContent(gs) {
        // Get GameAPI instance
        const gameAPI = gs || this.getApi();
        // Create container div
        const container = document.createElement('div');
        // Create and add title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = 'Current Answers';
        container.appendChild(titleBar);

        // Check if anyone has answered
        const hasAnswers = gameAPI.hasAnyoneAnswered();
        if (!hasAnswers) {
            console.debug('CurrentAnswers: No answers yet');
            return null;
        }

        let t = document.createElement('table');
        let answersHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Answer</th>
                        <th>Points</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;

        try {
            const players = gameAPI.getPlayers();
            if (!players) {
                console.warn('CurrentAnswers: No players data available');
                return null;
            }

            for (const [username, player] of Object.entries(players)) {
                if (player.isSpectator || player.isAdmin) continue;
                const hasAnswered = gameAPI.hasAnswered();
                const rowStyle = hasAnswered ? '' : 'style="background-color: #f0f0f0;"';

                const currentQuestion = gameAPI.getCurrentQuestion();
                if (!currentQuestion || !currentQuestion.answers) {
                    console.warn('CurrentAnswers: No current question or answers available');
                    continue;
                }

                const playerAnswer = currentQuestion.answers.find(a => a.username === username);
                answersHtml += `
                    <tr ${rowStyle}>
                        <td>${username}</td>
                        <td>${playerAnswer ? playerAnswer.answer : '...'}</td>
                        <td>${playerAnswer ? playerAnswer.points : '0'}</td>
                        <td>${playerAnswer ? playerAnswer.comment : ''}</td>
                    </tr>
                `;
            }

            answersHtml += `
                    </tbody>
                </table>
            `;
            t.innerHTML = answersHtml;
            container.appendChild(t);
            return container;
        } catch (error) {
            console.error('CurrentAnswers: Error creating content:', error);
            return null;
        }
    }
}
/**
 * Class which deals with displaying information about the answer to a question
 * once the question has ended. This is not automatically shown but requires
 * the host to enable the display, this allows questions to be re-run before
 * the answers are shown in case anyone misses the question
 */
class AnswerInfo extends PageElement {
    constructor() {
        super('answer-info',['*'])
    }

    shouldShow() {
        return false;
    }

    getContent(gs) {
        // Get GameAPI instance
        const gameAPI = gs || this.getApi();
        // Create container div
        const container = document.createElement('div');
        // Create and add title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = 'Answer Info';
        container.appendChild(titleBar);
        // table header
        let t = document.createElement('table');
        let h = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Info</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>comment here</td></tr>
                    <tr><td>link here</td></tr>
                </tbody>
            </table>
        `;
        t.innerHTML = h;
        container.appendChild(t);
        return container;
    }
}
/**
 * Class which deals with displaying the current players
 * and allows for administration of those players
 */
class PlayerAdmin extends PageElement {
    constructor() {
        super('player-admin',['*'])
        this.numplayers = 0;
        this.totalPoints = 0;
    }

    static click(username, action) {
        if (!username || !action) {return;}
        let pts = document.getElementById("player-admin-points");
        let points = 0;
        if (pts) {points = pts.value;}
        GameAPI.sendHttpRequest(`/api/players?username=${username}&action=${action}&points=${points}`);
    }

    createStyles() {
        return `
        .small-button {
            padding: 2px 4px;
            font-size: 0.8em;
            margin: 1px;
            border-radius: 2px;
            border: 1px solid #ccc;
            color: var(--bccstone);
            background-color: var(--bcclightblue);
            cursor: pointer;
            min-width: min-content;
            height: auto;
            white-space: nowrap;
            display: inline-block;
            color: white;
        }

        .small-button:hover {
            background-color: var(--bccblue);
        }
        .small-button:active {
            background-color: var(--bccblue);
        }
        #player-admin-points {
            width: 100%;
            cursor: auto;
            font-size: 1em;
            color: var(--bccblue);
            background-color: var(--bccstone);
            border-radius: 2px;
            border: 1px solid var(--bcclightblue);
            padding: 0.5em;
        }
        `
    }

    shouldUpdate() {
        let players = this.getPlayers()
        // count total number of players
        let currentPlayerCount = Object.keys(players).length;
        if (currentPlayerCount === 0) {return false;}

        // Calculate total score across all players
        let totalScore = 0;
        for (const [username, player] of Object.entries(players)) {
            if (!player.isSpectator && !player.isAdmin) {
                totalScore += player.score;
            }
        }
        if (this.totalPoints === totalScore) {
            // have we got new players?
            if (currentPlayerCount === this.numplayers) {
                return false;
            } else {
                this.numplayers = currentPlayerCount;
                return true;
            }
        } else {
            this.totalPoints = totalScore;
            return true;
        }
    }

    getContent(gs) {
        // Get players using the existing GameAPI method
        const players = this.getPlayers();
        if (!players) {
            console.warn("No players available");
            return null;
        }
        // Create container div
        const container = document.createElement('div');
        // Create table
        const t = document.createElement('table');
        let h = `
            <form name="players-form" id="players-form" action="/api/players" method="GET"  autocomplete="off" accept-charset="UTF-8">
            <table class="table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Score</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        try {
            for (const [username, player] of Object.entries(players)) {
                if (player.isSpectator || player.isAdmin) continue;

                h += `
                    <tr>
                        <td>${username}</td>
                        <td>${player.score}</td>
                        <td>
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','kick')" value="Kick" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','ban')" value="Ban" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','dock')" value="Dock" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','award')" value="Award" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','msg')" value="Message" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','rst')" value="Reset" />
                        </td>
                    </tr>
                `;
            }
            h += `
                    <tr>
                        <td colspan="3">
                            points/msg: <input type="text" name="player-admin-points" id="player-admin-points" value="" />
                        </td>
                    </tr>
                    </tbody>
                </table>
            </form>
            `;
            t.innerHTML = h;
            container.appendChild(t);
            return container;
        } catch (error) {
            console.error('PlayerAdmin: Error creating content:', error);
            return null;
        }
    }
}

/**
 * Deals with showing the user prompt and error messages etc
 */
class PlayerMessage extends PageElement {
    constructor() {
        super('player-message',['*'])
        this.initialised = false;
    }

    shouldShow() {
        let p = this.getCurrentPlayer()
        if (!p) {return false;}
        if (!p.message || p.message === "") {
            return false;
        }
        return true;
    }

    shouldUpdate() {
        let p = this.getCurrentPlayer()
        if (!p) {return false;}
        if (!p.message || p.message === "") {
            return false;
        }
        return true;
    }

    createStyles() {
        return `
            .player-message {
                background-color: var(--bccrust);
                border-color: var(--bccblue);
                color: var(--bccstone);
                display: flex;
                align-items: center;
                text-align: center;
                justify-content: center;
                position: relative;
                margin: 10px, 0;
                border: 1px inset white;
                overflow: hidden;
                padding: 0.5em;
                font-size: 1em;
            }
        `;
    }

    getContent(gs) {
        if (! this.initialised) {
            const container = document.createElement('div');
            container.id = "player-message-text";
            this.initialised = true;
            return container;
        }
        if (gs.currentUser && gs.currentUser.message) {
            let messageElement = document.getElementById("player-message-text");
            if (messageElement) {
                messageElement.textContent = gs.currentUser.message;
            }
        }
    }
}

/**
 * Class that deals with displaying the current total player rankings
 */
class Leaderboard extends PageElement {
    constructor() {
        super('leaderboard-div',['*'])
        this.currentTotalScore = 0;
    }

    shouldShow() {
        const gameAPI = this.getApi();
        // total up the number of points each player has
        let players = this.getPlayers()
        if (!players) {return false;}
        let totalScore = 0;
        for (const [username, player] of Object.entries(players)) {
            if (!player.isSpectator && !player.isAdmin) {
                totalScore += player.score;
            }
        }
        if (this.currentTotalScore === totalScore) {
            return false;
        } else {
            this.currentTotalScore = totalScore;
            return true;
        }
    }

    getContent(gs) {
        // Get GameAPI instance if gs is not provided
        const gameAPI = gs || this.getApi();
        // has anything changed?

        // Create container div
        const container = document.createElement('div');
        // Create and add title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = 'Current Standings';
        container.appendChild(titleBar);

        // Create table
        const t = document.createElement('table');
        let h = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Percent</th>
                    </tr>
                </thead>
                <tbody>
        `;

        try {
            const players = this.getPlayers();
            if (!players) {
                console.warn('Leaderboard: No players data available');
                return null;
            }

            for (const [username, player] of Object.entries(players)) {
                // Skip spectators and admin users
                if (player.isSpectator || player.isAdmin) continue;
                h += `
                    <tr>
                        <td>${username}</td>
                        <td>${player.percent}</td>
                    </tr>
                `;
            }
            h += `
                    </tbody>
                </table>
            `;
            t.innerHTML = h;
            container.appendChild(t);
            return container;
        } catch (error) {
            console.error('Leaderboard: Error creating content:', error);
            return null;
        }
    }
}
// ###################################################################
// TIMER
// ###################################################################

class Timer extends PageElement {
    constructor() {
        super('timer',['*']);
    }

    shouldShow() {
        let a = this.isQuestionActive();
        return a;
    }

    createStyles() {
        const css = `
            #timer {
                position: fixed;    /* glue to window */
                display: flex;
                top: 10px;          /* Match top-qr positioning */
                left: 5vw;          /* Mirror the right positioning of top-qr */
                width: 10vw;        /* Match top-qr width */
                aspect-ratio: 1;    /* square */
                justify-content: center;   /* valign centre */
                align-items: center;
                border-radius: 4px;
                padding-top: 3.6vw;
                font-size: 2vw;
                z-index: 1000;      /* Keep it above other elements */
                text-align: center;
                font-family: 'Seg', 'Share Tech Mono', monospace;
                background-color: #000;
                color: #ff0000;     /* Classic red LED color */
                border: 1px solid #333;
                letter-spacing: 2px;
                box-shadow:
                    inset 0 0 8px rgba(255, 0, 0, 0.2),
                    0 0 4px rgba(255, 0, 0, 0.2);
                background: linear-gradient(
                    to bottom,
                    #000000,
                    #1a1a1a
                );
            }

            #timer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 50%;
                background: linear-gradient(
                    rgba(255, 255, 255, 0.17),
                    rgba(255, 255, 255, 0)
                );
                border-radius: 2px;
                pointer-events: none;
            }
        `;
        return css;
    }

    getContent(gs) {
        if (!this.isQuestionActive()) {return null;}
        let timeLeft = this.getTimeLeft();
        let ret = document.createTextNode(timeLeft);
        return ret;
    }
}

// ###################################################################
// BUTTONS
// ###################################################################

// Base Button class for generic button animation and cooldown behavior
class AnimatedButton extends PageElement {

    constructor(elementId, cooldownTime = 5) {
        super(elementId, ['*']);
        this.COOLDOWN_TIME = cooldownTime;
        this.originalText = this.getElement()?.textContent || '';
    }

    isEnabled() {
        let ret = super.isEnabled()
        return ret;
    }

    // speeds things up a bit
    getStyles() {}

    /**
     * Handles the clicking of this button by calling
     * the extending object's implementation of 'buttonAction'
     * @param {*} e
     * @returns
     */
    handleClick(e) {
        const button = this.getElement();
        // Don't allow clicking if the button is disabled
        if (button.classList.contains('button-cooldown')) {
            button.title = this.originalText;
            return;
        }

        // first, do whatever is required of the button click
        let success = this.buttonAction();
        if (!success) {
            this.shake();
            return;
        }

        // now signal to the user, flash and enter cooldown mode
        button.classList.add('button-flash');
        setTimeout(() => {
            button.classList.remove('button-flash')
            button.classList.add('button-cooldown');
            this.setEnabled(false);
        }, 100);

        let timeLeft = this.COOLDOWN_TIME;
        const countdownInterval = setInterval(() => {
            button.textContent = `Wait ${timeLeft}s`;
            timeLeft--;
            if (timeLeft <= 0) {
                button.classList.remove('button-cooldown');
                button.textContent = this.originalText;
                clearInterval(countdownInterval);
                this.setEnabled(this.isEnabled());
            }
        }, 1000);
    }

    /**
     * method to indicate errors to the user
     * @returns null
     */
    shake() {
        const button = this.getElement();
        // Prevent multiple shakes
        if (button.classList.contains('button-shake')) return;
        // Add shake class
        let cl = button.classList
        button.classList.remove('button-flash')
        button.classList.remove('button-disabled')
        button.classList.remove('button-cooldown')
        button.classList.add('button-shake');
        // Remove shake class after animation completes
        setTimeout(() => {
            button.textContent = this.originalText;
            button.classList = cl
        }, 500);
    }

    setEnabled(enabled) {
        let button = this.getElement();
        if (button) {
            if (enabled) {
                button.classList.remove('button-disabled');
                button.title = ''; // Remove any tooltip
                button.textContent = this.originalText;
            } else {
                button.classList.add('button-disabled');
                button.title = "no clicky";
            }
        }
    }

    getContent(gs) {
        const button = this.getElement();
        button.classList.add('btn');
        // Only bind once and store the bound handler
        if (!this.boundHandleClick) {
            this.boundHandleClick = this.handleClick.bind(this);
        }
        let cn = this.classname;
        button.addEventListener('click', this.boundHandleClick);
        let ia = this.isEnabled()
        this.setEnabled(ia);
    }

    /**
     * overriden by extending class to perform whatever
     * action is required when the user clicks this  button
     * @param {*} e the mouse click event
     * @returns true if the button action was successful, false otherwise
     */
    async buttonAction(e) {
        return true;
    }
}

// Example implementation for Next Question Button
class NextQuestionButton extends AnimatedButton {
    constructor() {
        super('next-question-button', 2);
    }

    async buttonAction() {
        await fetch('/api/next-question')
            .then(response => {
                if (!response.ok) {
                    return false;
                }
                return true
            })
            .catch(error => {return false;});
    }

    isEnabled() {
        let a = super.isQuestionActive()
        return !a;
    }
}

// Example implementation for Previous Question Button
class PreviousQuestionButton extends AnimatedButton {
    constructor() {
        super('previous-question-button', 2); // 2 second cooldown
    }

    async buttonAction() {
        await fetch('/api/previous-question')
        .then(response => {
            if (!response.ok) {
                return false;
            }
            return true
        })
        .catch(error => {return false;});
    }

    isEnabled() {
        let a = super.isQuestionActive()
        return !a;
    }
}

// Example implementation for Start Question Button
class StartQuestionButton extends AnimatedButton {
    constructor() {
        super('start-question-button', 3); // 3 second cooldown
    }

    async buttonAction() {
        await fetch('/api/start-question')
        .then(response => {
            if (!response.ok) {
                console.warn("bad response from start question");
                return false;
            }
            console.debug("good response from start question");
            return true
        })
        .catch(error => {
            console.error("error from start question", error);
            return false;
        });
    }

    isEnabled() {
        let a = super.isQuestionActive()
        return !a;
    }
}

// Example implementation for Start Question Button
class PauseQuestionButton extends AnimatedButton {
    constructor() {
        super('pause-question-button', 3); // 3 second cooldown
    }

    async buttonAction() {
        await fetch('/api/pause-question')
        .then(response => {
            if (!response.ok) {
                return false;
            }
            return true
        })
        .catch(error => {return false;});
    }
}

// Example implementation for Start Question Button
class StopQuestionButton extends AnimatedButton {
    constructor() {
        super('stop-question-button', 3); // 3 second cooldown
    }

    async buttonAction() {
        await fetch('/api/stop-question')
        .then(response => {
            if (!response.ok) {
                return false;
            }
            return true
        })
        .catch(error => {return false;});
    }
}

// Example implementation for Next Question Button
class ShowAnswerInfo extends AnimatedButton {
    constructor() {
        super('show-info-button', 2);
    }

    async buttonAction() {
        // toggle the table visibility
    }

}

/**
 * The button used to submit answers on all question types
 */
class AnswerButton extends AnimatedButton {
    constructor() {
        super('answer-button', 5); // 5 second cooldown
    }

    buttonAction() {
        let a = this.getApi()
        let success = a.submitAnswer();
        return success;
    }

    doShouldShow() {
        let ret = super.doShouldShow();
        return ret;
    }

    isEnabled() {
        let foo = super.isEnabled();
        if (!foo) {return false;}
        let answered = this.hasAnswered()
        if (answered) {return false;}
        return true;
    }
}
// ###################################################################
// MULTICHOICE
// ###################################################################

class MultiChoice extends PageElement {
    constructor() {
        super('multi-choice-container', ['multichoice']); // ensure lowercase
        this.choices = null;
        this.selectedChoice = null;
    }

    /**
     * If this multichoice question has image content then load the image
     * into the main container div
     * @param {*} container the parent container we are going to populate
     * @returns null (amends the given container object)
     */
    createImageDiv(container) {
        if (!container) {return;}
        let cq = this.getCurrentQuestion();
        // If there's an image URL, create and add the image container
        if (cq.imageUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'multi-choice-image-container';
            imageContainer.id = "multi-choice-image-container";
            const image = document.createElement('img');
            image.src = cq.imageUrl;
            image.alt = 'Question Image';
            image.className = 'multi-choice-image';

            // Add loading state
            image.style.opacity = '0';
            image.style.transition = 'opacity 0.3s ease-in';
            // Show image when loaded
            image.onload = () => {
                image.style.opacity = '1';
            };
            // Handle loading errors
            image.onerror = () => {
                console.error('Failed to load image:', cq.imageUrl);
                imageContainer.remove();
            };
            imageContainer.appendChild(image);
            container.appendChild(imageContainer);
        }
    }

    /**
     * Creates the actual multichoice radio button group dom elements
     * @param {*} container the parent container we are going to populate
     * @returns null (amends the given container object)
     */
    createButtons(container) {
        if (!container) {return;}
        let cq = this.getCurrentQuestion();
        let a = this.getApi();
        let currentAnswer = this.getCurrentAnswer();
        this.choices = cq.choices;

        const pc = document.createElement('div');
        pc.className = 'multi-choice-buttons-container';
        pc.id = "multi-choice-buttons-container";
        pc.role = 'radiogroup'; // Accessibility
        pc.setAttribute('aria-label', 'Answer choices');

        // Create a button for each choice
        cq.choices.forEach((choice, index) => {
            let img = choice.imgUrl;
            const button = document.createElement('button');
            button.id = choice.answer
            button.setAttribute('data-choice-index', index);
            button.className = 'multi-choice-button';
            button.innerHTML = choice.choice;
            button.setAttribute('role', 'radio'); // Accessibility
            button.setAttribute('aria-checked', 'false');

            if (img) {
                const i = document.createElement('img');
                i.src = img;
                i.style.height = '2em';
                i.style.width = 'auto';
                i.style.marginRight = '8px';
                button.appendChild(i);
            }

            if (currentAnswer) {
                if (button.id === currentAnswer.answer) {
                    button.classList.add('selected');
                    button.setAttribute('aria-checked', 'true');
                    button.disabled = true;
                    button.style.cursor = 'default';
                    button.classList.add('answered');
                    button.addEventListener('click', () => {});
                }
            } else {
                // Add click handler
                button.addEventListener('click', (e) => {
                    // Remove selected class from all buttons
                    container.querySelectorAll('.multi-choice-button').forEach(btn => {
                        btn.classList.remove('selected');
                        btn.setAttribute('aria-checked', 'false');
                    });

                    // Add selected class to clicked button
                    button.classList.add('selected');
                    button.setAttribute('aria-checked', 'true');
                    // make the button itself the selected answer
                    let answer = a.createAnswerObject();
                    answer.answer = button.innerHTML;
                    answer.comment = button.id;
                    this.selectedChoice = answer;
                });
            }
            pc.appendChild(button);
        });
        container.appendChild(pc);
    }

    getContent(api) {
        api = api || this.getApi();
        const cq = this.getCurrentQuestion();
        if (!cq || !cq.choices) {
            console.debug('MultiChoice: No question or choices available');
            return;
        }
        // Only update if choices have changed
        if (this.choices && api.compareArrays(this.choices, cq.choices)) {
            return;
        }
        this.choices = cq.choices;
        // Create main container
        const container = document.createElement('div');
        // populate the container
        this.createImageDiv(container);
        this.createButtons(container);
        return container;
    }

    // Add these styles to createStyles()
    createStyles() {
        const ret = `
            #multi-choice-container {
                padding: 15px;
                margin: 0 auto;
                visibility: visible !important; /* Force visibility */
            }

            .multi-choice-image-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto 20px auto;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .multi-choice-image {
                width: 100%;
                height: auto;
                display: block;
                object-fit: contain;
            }

            .multi-choice-buttons-container {
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: 100%;
                visibility: visible !important; /* Force visibility */
            }

            .multi-choice-main-container {
                display: flex;
                flex-direction: column;
                width: 100%;
                gap: 20px;
                padding: 20px;
            }

            .multi-choice-button {
                width: 100%;
                padding: 15px 20px;
                padding-left: 45px;
                border: 2px solid var(--bccblue);
                border-radius: 8px;
                background: white;
                cursor: pointer;
                text-align: left;
                font-size: 16px;
                transition: all 0.2s ease;
                position: relative;
                visibility: visible !important; /* Force visibility */
            }

            .multi-choice-button::before {
                content: '';
                position: absolute;
                left: 15px;
                top: 50%;
                transform: translateY(-50%);
                width: 20px;
                height: 20px;
                border: 2px solid var(--bccblue);
                border-radius: 50%;
                background: white;
                transition: all 0.2s ease;
            }

            .multi-choice-button.selected {
                background: var(--bccblue);
                color: var(--bccstone);
            }

            .multi-choice-button.selected::before {
                background: var(--bccstone);
                border-color: var(--bccstone);
            }

            .multi-choice-button.selected::after {
                content: '';
                position: absolute;
                left: 19px;
                top: 50%;
                transform: translateY(-50%);
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--bccblue);
            }

            .multi-choice-button:hover {
                background: var(--bccblue);
                color: white;
            }
            .multi-choice-button.answered {
                opacity: 0.7;
                pointer-events: none;
                border-color: #ccc;
            }
            .multi-choice-button.answered::before {
                border-color: #ccc;
            }
        `;
        return ret;
    }

    disableButtons() {
        const buttons = document.querySelectorAll('.multi-choice-button');
        buttons.forEach(button => {
            button.disabled = true;
            button.style.cursor = 'default';
            button.classList.add('answered');
        });
        this.isAnswered = true;
    }

    getAnswer() {
        let answer = this.selectedChoice;
        if (!answer) {return null;}
        //calculate points
        let cq = this.getCurrentQuestion();
        let ca = cq.correctAnswers[0];
        // we have to use comment instead of answer field
        if (ca === answer.comment) {
            answer.points = cq.pointsAvailable;
            answer.comment = "yes";
        } else {
            answer.points = 0;
            answer.comment = "no";
        }
        this.disableButtons();
        return answer;
    }
}

// ###################################################################
// FREETEXT
// ###################################################################

class FreeText extends PageElement {
    constructor() {
        super('free-text-container', ['freetext']);
        this.textInput = null;
        this.container = null;
    }

    shouldUpdate() {
        if (!this.container) {return true;}
        return false;
    }

    createImageDiv(container) {
        if (!container) {return;}
        let cq = this.getCurrentQuestion();
        // If there's an image URL, create and add the image container
        if (cq.imageUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'free-text-image-container';
            imageContainer.id = "free-text-image-container";
            const image = document.createElement('img');
            image.src = cq.imageUrl;
            image.alt = 'Question Image';
            image.className = 'free-text-image';

            // Add loading state
            image.style.opacity = '0';
            image.style.transition = 'opacity 0.3s ease-in';
            // Show image when loaded
            image.onload = () => {
                image.style.opacity = '1';
            };
            // Handle loading errors
            image.onerror = () => {
                console.error('Failed to load image:', cq.imageUrl);
                imageContainer.remove();
            };
            imageContainer.appendChild(image);
            container.appendChild(imageContainer);
        }
    }

    createInputArea(container) {
        if (!container) {return;}
        let a = this.getApi();

        const inputContainer = document.createElement('div');
        inputContainer.className = 'free-text-input-container';

        // Create text input
        this.textInput = document.createElement('input');
        this.textInput.type = 'text';
        this.textInput.id = 'free-text-input';
        this.textInput.className = 'free-text-input';
        this.textInput.placeholder = 'Type your answer here...';
        inputContainer.appendChild(this.textInput);
        container.appendChild(inputContainer);
    }

    getContent(api) {
        this.container = document.createElement('div');
        this.createImageDiv(this.container);
        this.createInputArea(this.container);
        return this.container;
    }

    createStyles() {
        const ret = `
            #free-text-container {
                padding: 15px;
                margin: 0 auto;
                visibility: visible !important;
            }

            .free-text-image-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto 20px auto;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .free-text-image {
                width: 100%;
                height: auto;
                display: block;
                object-fit: contain;
            }

            .free-text-input-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }

            .free-text-input {
                width: 100%;
                padding: 15px 20px;
                border: 2px solid var(--bccblue);
                border-radius: 8px;
                background: white;
                font-size: 16px;
                transition: all 0.2s ease;
            }

            .free-text-input:focus {
                outline: none;
                box-shadow: 0 0 0 2px rgba(var(--bccblue-rgb), 0.2);
            }

            .free-text-input::placeholder {
                color: #999;
            }
        `;
        return ret;
    }

    fuzzyMatch(str1, str2) {
        // Normalize strings: lowercase and remove extra spaces
        str1 = str1.toLowerCase().trim();
        str2 = str2.toLowerCase().trim();

        // Find the shortest and longest strings
        let shorter = str1.length <= str2.length ? str1 : str2;
        let longer = str1.length > str2.length ? str1 : str2;

        // Try to find the best partial match by sliding the shorter string
        // across the longer string
        let minDistance = Infinity;

        for (let i = 0; i <= longer.length - shorter.length; i++) {
            const substring = longer.substr(i, shorter.length);
            const distance = this.levenshteinDistance(shorter, substring);
            minDistance = Math.min(minDistance, distance);

            // Early exit if we find a perfect match
            if (minDistance === 0) break;
        }

        return minDistance;
    }

    // Separate the core Levenshtein distance calculation
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;

        let matrix = Array(len1 + 1);
        for (let i = 0; i <= len1; i++) {
            matrix[i] = Array(len2 + 1);
        }

        for (let i = 0; i <= len1; i++) {
            matrix[i][0] = i;
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,     // deletion
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j - 1] + 1  // substitution
                    );
                }
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Uses fuzzy logic to determine if the user has answered
     * the question adequately.
     * currentQuestion.penalisationFactor is used to tune 'how wrong'
     * User input can be and still be considered a correct answer
     * @see {PageElement#getAnswer()}
     * @returns {Object} the scored answer object
     */
    getAnswer() {
        const gs = this.getApi();
        let answer = gs.createAnswerObject();

        // Get the text input element
        const textInput = this.getElement().querySelector('input[type="text"]');
        if (!textInput) {return null;}

        // Get the text value and trim whitespace
        const textValue = textInput.value.trim();
        if (!textValue || textValue === "") {
            return null;
        }

        // Get the current question to access the correct answer
        const currentQuestion = gs.getCurrentQuestion();
        if (!currentQuestion || !currentQuestion.correctAnswers || !currentQuestion.penalisationFactor) {
            console.warn('FreeText: No correct answer available or missing penalisationFactor');
            return null;
        }
        let maxDistance = parseInt(currentQuestion.penalisationFactor);
        if (isNaN(maxDistance)) {
            console.warn('FreeText: penalisationFactor is not a number');
            return null;
        }
        if (maxDistance == 0) {
            if (currentQuestion.correctAnswers.includes(textInput)) {
                answer.points = currentQuestion.pointsAvailable;
            } else {
                answer.points = 0;
            }
            return answer;
        }
        for (const ca of currentQuestion.correctAnswers) {
            // Calculate the Levenshtein distance between user input and correct answer
            const distance = this.fuzzyMatch(
                textValue.toLowerCase(),
                ca.toLowerCase()
            );
            // console.info(`Levenshtein distance: ${distance}`);
            const maxLength = Math.max(textValue.length, ca.length);
            const similarity = 1 - (distance / maxLength);
            answer.comment = `Similarity: ${Math.round(similarity * 100)}%`;
            if (distance <= maxDistance) {
                console.info(`right answer.. pf = ${maxDistance} actual distance ${distance}`);
                answer.points = currentQuestion.pointsAvailable;
                answer.answer = ca;
                break;
            } else {
                answer.points = 0
                answer.answer = ca
            }
        }
        return answer;
    }
}

// ###################################################################
// GLOBAL
// ###################################################################

// Initialize appropriate UI when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // start the game API singleton if it hasn't already been started
    // This will also start pollling the server for game state updates
    const gameApi = GameAPI.getInstance();
});