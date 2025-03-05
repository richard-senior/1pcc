/**
 * Singleton class which manages interaction with the server API
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
        // contains a list of all page elements
        this.allPageElements = []
        // Initialize the game type classes
        this.allPageElements.push(new QuestionView());
        this.allPageElements.push(new ClickMap());
        this.allPageElements.push(new FreeText());
        this.allPageElements.push(new MultiChoice());
        this.allPageElements.push(new StreetView());
        this.allPageElements.push(new Leaderboard());
        // Initialize buttons
        this.allPageElements.push(new AnswerButton());
        this.allPageElements.push(new NextQuestionButton());
        this.allPageElements.push(new PreviousQuestionButton());
        this.allPageElements.push(new StartQuestionButton());
        this.allPageElements.push(new StopQuestionButton());
        this.allPageElements.push(new PauseQuestionButton());
        // Initialise the timer
        this.allPageElements.push(new Timer());
        // observer
        this.allPageElements.push(new Leaderboard());
        this.allPageElements.push(new CurrentAnswers());
        // holds page elements relevant to the current page and question
        this.pageElements = this.allPageElements;
        // register some handlers
        window.addEventListener('questionChanged', (event) => {
            console.log("questionChanged handler invoked");
        });
        window.addEventListener('questionTimedOut', (event) => {
            console.log("questionTimedOut handler invoked");
        });
        GameAPI.instance = this;
        // start polling
        this.startPolling();
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
     * Updates the current data held in this.state and window.gameState
     * which is accessible via GameAPI.getGameState()
     * This data represents the current state of the game as returned
     * from the server /api as a JSON object
     * This method is polled every N seconds.
     * @returns {void}
     */
    async update() {
        try {
            const response = await fetch('/api/game-state').catch(error => {return { ok: false };});
            if (!response.ok) {
                this.failureCount++;
                console.warn(`Failed to get game state ${this.failureCount} times`);
                if (this.failureCount >= this.maxFailures) {
                    console.warn(`Stopping polls after ${this.maxFailures} failures`);
                    this.stopPolling();
                }
            }
            // Reset failure count on success
            this.failureCount = 0;
            const newState = await response.json();
            this.state = newState;
            this.currentUser = newState.currentUser;
            window.gameState = newState;
            // update the local timer countdown cacheed number
            this.setTimeLeft(newState.currentQuestion.timeLeft);
            // update the local question cache
            if (!this.currentQuestion) {
                this.currentQuestion = newState.currentQuestion;
            } else {
                this.setCurrentQuestion(newState.currentQuestion);
            }
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
        if (typeof t !== 'number' || isNaN(t) || t < 0) {
            console.warn("was sent an invalid time left value");
            this.timeLeft = 0;
        } else {
            this.timeLeft = t;
        }

        if (this.timeLeft <= 0) {
            if (this.previousTimeLeft > 0) {
                this.timeLeft = 0;
                console.info("Timer : 0");
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
    /**
     * Gets the currently logged in user
     * @returns the current user
     */
    getCurrentUser() {
        // first check if we have this member variable
        let s = GameAPI.getGameState();
        // try the dom
        if (!s) {s = window.gameState}
        // ok error!
        if (!s) {return null;}
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
        if (this.currentQuestion.questionNumber !== question.questionNumber) {
            this.currentQuestion = question;
            // Reduce the size of the array based on whether page elements exist
            this.pageElements = this.allPageElements.filter(pe => pe.getContent());
            window.dispatchEvent(new CustomEvent('questionChanged', {detail: question}));
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
     * @returns bool true if the current user has answered the current question
     */
    hasAnswered() {
        //return true if the current user has answered the current question
        let cq = this.getCurrentQuestion();
        if (!cq) {return false;}
        let answers = cq.answers;
        if (!answers) {return false;}
        let currentUser = this.getCurrentUser();
        if (!currentUser) {return false;}
        let username = currentUser.username;
        if (!username) {return false;}
        for (let a of answers) {
            if (a.username === username) {return true;}
        }
        return false;
    }

    startPolling(interval = 2000) { // Poll every 2 seconds by default
        this.stopPolling(); // Clear any existing interval
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
            "username": this.getCurrentUser()?.username ?? null,
            "answer": null,
            "comment": null,
            "points": null,
        };
        return answer;
    }
    /**
     * Submits the answer object to the server
     * @returns {boolean} true if the answer was accepted, false otherwise
     */
    async submitAnswer() {
        let cq = this.getCurrentQuestion()
        if (!this.isQuestionActive()) {
            console.log('Question is not active, cannot submit answer');
            return false;
        }

        // work out what and where the answer is based on
        // what the current question is
        let questionType = cq?.type ?? 'unknown';
        console.log('Submitting answer for question type:', questionType);

        // Find the appropriate page element for this question type
        let answerComponent = this.allPageElements.find(element => {
            if (questionType === 'geolocation' && element instanceof ClickMap) return true;
            if (questionType === 'multichoice' && element instanceof MultiChoice) return true;
            if (questionType === 'freetext' && element instanceof FreeText) return true;
            return false;
        });

        if (!answerComponent) {
            console.warn("Could not find appropriate component for question type:", questionType);
            return false;
        }

        let answer = answerComponent.getAnswer();

        if (!answer) {
            console.warn("No answer provided");
            return false;
        }

        try {
            let s = JSON.stringify(answer);
            console.log('Submitting answer:', s);
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

    getFileContent(filePath) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', filePath, false);
        try {
            xhr.send();
            if (xhr.status !== 200) {
                console.error('Failed to load SVG:', xhr.statusText);
                return null;
            }
            return  xhr.responseText;
        } catch (error) {
            console.error('Error loading SVG:', error);
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
 */
class PageElement {
    constructor(name, questionTypes) {
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
     * Concenience method for getting the current players map
     * @returns {Players} the current players map
     */
    getPlayers() {return this.getApi().getPlayers()}
    /**
     * By default will return true if the current question is
     * counting down. False otherwise.
     * May be overriden to provide different hueristics.
     * @returns {boolean} true if this page element is enabled
     */
    isEnabled() {return this.isQuestionActive();}
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
        if (!this.getCurrentQuestion()) {
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
        if (!this.doShouldUpdate()) {
            return;
        }
        this.getStyles();
        //console.log("updating " + cn)
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
            console.debug("no styles")
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
        // Check if this PageElement supports the current game type
        // this is non-negotiable
        if (qt && Array.isArray(qt) && !qt.includes("*")) {
            if (!qt.includes(cq.type)) {
                this.hide();
                return false;
            }
        }
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
        let el = this.getElement()
        //el.style.position = 'relative'
        el.style.visibility = 'visible';
        el.style.display = 'block';
    }
    /**
     * sets the managed page elements style visibility and
     * display parameters such that the element is hidden
     * @returns {void}
     */
    hide() {
        let el = this.getElement()
        el.style.visibility = 'hidden';
        el.style.display = 'none';
    }
}

// ###################################################################
// QUESTION
// ###################################################################
/**
 * PageElement which manages the display of the actual question
 * that is the text or otherwise which prompts the player for a response
 */
class QuestionView extends PageElement {
    constructor() {
        super('question-title', ['*'])
    }
    getStyles() {}
    getContent(gs) {
        let cq = this.getCurrentQuestion();
        if (!cq) {return;}
        let s = cq.questionNumber + ') ' + cq.question
        let ret = document.createTextNode(s);
        return ret;
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

    update(api) {
        super.update(api)
    }

    /** just speed things up a little */
    getStyles() {}

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
        this.iframe.allow = "xr-spatial-tracking; accelerometer; gyroscope; magnetometer; autoplay; encrypted-media; picture-in-picture;";
        this.iframe.sandbox = "allow-scripts allow-same-origin";
        this.iframe.allowfullscreen="false"
        this.iframe.loading="lazy"
        this.iframe.referrerpolicy="no-referrer-when-downgrade"
        // Create the semi-transparent blur overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '300px';
        overlay.style.height = '80px';
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
            console.error('Error: Invalid SVG document');
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

        // Initialize events after adding to DOM
        this.initializeEvents();

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

        a.answer = `${this.answerx},${this.answery}`;

        // Parse the correct answer coordinates
        const [correctX, correctY] = cq.correctAnswer
            .replace(/\s+/g, '')
            .split(',')
            .map(num => parseFloat(num));

        // Calculate actual distance using Pythagorean theorem
        const dx = this.answerx - correctX;
        const dy = this.answery - correctY;
        const dt = Math.sqrt(dx * dx + dy * dy);
        // this is the pixels to miles ratio
        let miles = Math.round(dt * 3.4);  // Round to nearest whole number
        a.comment = `${miles} miles off`

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
        a.points = Math.round(ap * accuracy);

        // Ensure points don't go negative
        if (a.points < 0) a.points = 0;

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
        const container = this.getElement()
        container.style.cursor = 'default';
        container.addEventListener('mousemove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.svg) return;

            // Update mouse position tracking
            this.prevmx = this.mx;
            this.prevmy = this.my;
            this.mx = e.clientX;
            this.my = e.clientY;
            //const dx = e.clientX - this.startPoint.x;
            //const dy = e.clientY - this.startPoint.y;
            if (this.isDragging) {
                // do dragging
                const box = this.svg.viewBox.baseVal;
                const scale = box.width / this.svg.clientWidth;

                // Calculate the movement delta
                const dx = (this.mx - this.prevmx) * scale;
                const dy = (this.my - this.prevmy) * scale;

                // Update viewBox by moving it opposite to the drag direction
                box.x -= dx;
                box.y -= dy;
                this.dragx += dx
                this.dragy += dy
            }
        });

        container.addEventListener('mouseleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.clearInterval()
            if (!this.svg) return;
            this.isDragging = false
            container.style.cursor = 'default';
        });

        container.addEventListener('mouseup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.clearInterval()
            if (!this.svg) return;
            // mouse up go back to ordinary mouse pointer
            container.style.cursor = 'default';
            if (this.isDragging) {
                // we've finished dragging
                this.isDragging = false;
            } else {
                // nothing to do here?
            }
        });

        // Mouse down handler
        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.svg) return;
            // if we're already waiting for a timer to finish then cancel it?
            window.clearInterval()
            // note the mouse current location
            let tx = e.clientX
            let ty = e.clientY
            // wait a short time and check if the mouse moves
            window.setTimeout(() => {
                const dx = Math.abs(tx - this.mx);
                const dy = Math.abs(ty - this.my);
                console.info("dx " + dx + ": dy " + dy)
                // has the mouse moved?
                // TODO change this for 'approximate' has the mouse moved
                if (dx > 1 || dy > 1) {
                    this.isDragging = true;
                    container.style.cursor = 'grabbing';
                    // this is a drag event
                    // initiate drag
                } else {
                    this.isDragging = false;
                    container.style.cursor = 'default';
                    this.addMarker()
                    // do nothing until mouseup
                }
            }, 350);
        });

        // In initializeEvents():
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Don't zoom if we're dragging
            if (this.isDragging) return;

            const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.zoom(scaleFactor, mouseX, mouseY);
        }, { passive: false });

        // Track second pointer for pinch zoom detection
        container.addEventListener('pointerdown', (e) => {
            if (e.isPrimary === false) {
                this.secondPointerDown = true;
            }
        });
        container.addEventListener('pointerup', (e) => {
            if (e.isPrimary === false) {
                this.secondPointerDown = false;
            }
        });
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

    getStyles() {}

    getContent(gs) {
        // Get GameAPI instance
        const gameAPI = gs || this.getApi();
        if (!gameAPI) {
            console.warn('CurrentAnswers: Could not get GameAPI instance');
            return null;
        }

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
                // Skip spectators and admins
                if (player.isSpectator || player.isAdmin) continue;

                const hasAnswered = gameAPI.hasAnswered();
                const rowStyle = hasAnswered ? '' : 'style="background-color: #f0f0f0;"';

                // Get current question and find player's answer
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
            return t;

        } catch (error) {
            console.error('CurrentAnswers: Error creating content:', error);
            return null;
        }
    }
}


class Leaderboard extends PageElement {
    constructor() {
        super('leaderboard-div',['*'])
    }

    getStyles() {}

    getContent(gs) {
        // Get GameAPI instance if gs is not provided
        const gameAPI = gs || this.getApi();
        if (!gameAPI) {
            console.warn('Leaderboard: Could not get GameAPI instance');
            return null;
        }

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
            const players = gameAPI.getPlayers();
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
            return t;

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

    doShouldUpdate() {
        let u = super.doShouldUpdate()
        return u;
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
        this.initialised = false;
        this.disabled = false;
    }
    // speeds things up a bit
    // styles are declared in the buttons section of main.css
    // because there may be many buttons all with the same css
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
        if (this.disabled || button.classList.contains('button-cooldown')) {
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
        let button = this.getElement();``
        if (enabled) {
            button.classList.remove('button-disabled');
            button.title = ''; // Remove any tooltip
            button.textContent = this.originalText;
            this.disabled = false
        } else {
            button.classList.add('button-disabled');
            button.title = "no clicky";
            this.disabled = true
        }
    }

    getContent(gs) {
        if (!this.initialised) {
            const button = this.getElement();
            // Add the btn class
            button.classList.add('btn');
            // Remove any existing click listeners to prevent duplicates
            button.removeEventListener('click', this.handleClick);
            // Bind the handler to preserve 'this' context and add the listener
            this.handleClick = this.handleClick.bind(this);
            button.addEventListener('click', this.handleClick);
            this.initialised = true;
        }
        let ia = this.isEnabled()
        if (ia && this.disabled) {
            this.setEnabled(true);
        } else if (!ia && !this.disabled) {
            this.setEnabled(false);
        }
        return null;
    }

    /**
     * overriden by extending class to perform whatever
     * action is required when the user clicks this  button
     * @param {*} e the mouse click event
     * @returns true if the button action was successful, false otherwise
     */
    async buttonAction(e) {
        console.warn('buttonAction not implemented');
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
        let a = this.getApi()
        if (!a.isQuestionActive()) {return true;}
        return false;
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
        let a = this.getApi()
        if (!a.isQuestionActive()) {return true;}
        return false;
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
        let a = this.getApi()
        if (!a.isQuestionActive()) {return true;}
        return false;
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
/**
 * The button used to submit answers on all question types
 */
class AnswerButton extends AnimatedButton {
    constructor() {
        super('answer-button', 5); // 5 second cooldown
    }

    buttonAction() {
        let a = this.getApi()
        console.info("submitting answer");
        return a.submitAnswer();
    }

    isEnabled() {
        let a = this.getApi()
        let foo = super.isEnabled();
        if (!foo) {return false;}
        let answered = a.hasAnswered()
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

    // Override shouldShow to help debug visibility issues
    doShouldShow() {
        return super.doShouldShow();
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
        this.choices = cq.choices;

        const pc = document.createElement('div');
        pc.className = 'multi-choice-buttons-container';
        pc.id = "multi-choice-buttons-container";
        pc.role = 'radiogroup'; // Accessibility
        pc.setAttribute('aria-label', 'Answer choices');

        // Create a button for each choice
        cq.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'multi-choice-button';
            button.textContent = choice;
            button.setAttribute('role', 'radio'); // Accessibility
            button.setAttribute('aria-checked', 'false');

            // If this was previously selected, restore the state
            if (choice === this.selectedChoice) {
                button.classList.add('selected');
                button.setAttribute('aria-checked', 'true');
            }

            // Add click handler
            button.addEventListener('click', () => {
                // Remove selected class from all buttons
                container.querySelectorAll('.multi-choice-button').forEach(btn => {
                    btn.classList.remove('selected');
                    btn.setAttribute('aria-checked', 'false');
                });

                // Add selected class to clicked button
                button.classList.add('selected');
                button.setAttribute('aria-checked', 'true');

                // Store the choice
                this.selectedChoice = choice;

                // Update game state
                const answer = a.createAnswerObject();
                answer.answer = choice;
                this.selectedChoice = answer;
            });
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
                color: white;
            }

            .multi-choice-button.selected::before {
                background: white;
                border-color: white;
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
        `;
        return ret;
    }

    /**
     * Finds which radio button is clicked (if any) and returns
     * the text value of that button
     * @returns {string} the text of the selected radio button
     */
    getSelectedChoice() {
        // Get the container that holds all the buttons
        const container = this.getElement();
        if (!container) {
            console.warn('MultiChoice: Container not found');
            return null;
        }

        // Find the button that has the 'selected' class
        const selectedButton = container.querySelector('.multi-choice-button.selected');
        if (!selectedButton) {
            console.warn('MultiChoice: No button selected');
            return null;
        }

        // Return the text content of the selected button
        return selectedButton.textContent;
    }

    getAnswer() {
        const a = this.getApi();
        let answer = a.createAnswerObject();
        const selectedChoice = this.getSelectedChoice();
        if (!selectedChoice) {
            console.warn('No choice selected');
            return null;
        }
        // Populate the answer object
        answer.answer = selectedChoice;
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
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + 1
              );
            }
          }
        }
        return matrix[len1][len2];
      }

      getAnswer() {
        const gameAPI = this.getApi();
        let answer = gameAPI.createAnswerObject();

        // Get the text input element
        const textInput = this.getElement().querySelector('input[type="text"]');
        if (!textInput) {
            console.warn('FreeText: Text input element not found');
            return null;
        }

        // Get the text value and trim whitespace
        const textValue = textInput.value.trim();
        if (!textValue) {
            console.warn('FreeText: No text entered');
            return null;
        }

        // Get the current question to access the correct answer
        const currentQuestion = gameAPI.getCurrentQuestion();
        if (!currentQuestion || !currentQuestion.correctAnswer) {
            console.warn('FreeText: No correct answer available');
            return null;
        }

        // Calculate the Levenshtein distance between user input and correct answer
        const distance = this.fuzzyMatch(
            textValue.toLowerCase(),
            currentQuestion.correctAnswer.toLowerCase()
        );
        console.info(`Levenshtein distance: ${distance}`);
        // You might want to adjust these thresholds based on your needs
        const maxLength = Math.max(textValue.length, currentQuestion.correctAnswer.length);
        const similarity = 1 - (distance / maxLength);

        console.info(`Answer similarity: ${similarity * 100}%`);

        // Calculate points based on similarity
        answer.points = Math.round(currentQuestion.pointsAvailable * similarity);
        answer.answer = textValue;
        answer.comment = `Similarity: ${Math.round(similarity * 100)}%`;

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

    // TODO replace this when everything implements PageElement
    //window.addEventListener('gameStateUpdated', updateAll);
});