class GameAPI {

    constructor() {
        if (GameAPI.instance) {return GameAPI.instance;}
        this.state = null;
        this.currentUser = null;
        this.pollInterval = null;
        this.failureCount = 0;  // Add failure counter
        this.maxFailures = 1800;   // Maximum failures before stopping polls
        // Initialize the game type classes
        this.questionView = new QuestionView();
        this.clickMap = new ClickMap();
        this.streetView = new StreetView();
        this.multiChoice = new MultiChoice();
        this.leaderboard = new Leaderboard();
        // Initialize buttons
        this.answerButton = new AnswerButton();
        this.nextQuestionButton = new NextQuestionButton();
        this.previousQuestionButton = new PreviousQuestionButton();
        this.startQuestionButton = new StartQuestionButton();
        this.stopQuestionButton = new StopQuestionButton()
        this.pauseQuestionButton = new PauseQuestionButton()
        // Initialise the timer
        this.timer = new Timer();
        // observer
        this.leaderboard = new Leaderboard()
        this.currentAnswers = new CurrentAnswers()
        // add 'PageElement' objects to an array we can update on poll
        // TODO find any object implementing PageElement and add to array automatically
        this.pageElements = [
            this.streetView,
            this.clickMap,
            this.questionView,
            this.timer,
            this.answerButton,
            this.startQuestionButton,
            this.pauseQuestionButton,
            this.stopQuestionButton,
            this.nextQuestionButton,
            this.previousQuestionButton,
            this.leaderboard,
            this.currentAnswers,
        ];
        // start polling
        this.startPolling();
        GameAPI.instance = this;
    }

    // Static method to get instance
    static getInstance() {
        if (!GameAPI.instance) {
            GameAPI.instance = new GameAPI();
        }
        return GameAPI.instance;
    }

    async getGameState() {
        try {
            const response = await fetch('/api/game-state').catch(error => {return { ok: false };});
            if (!response.ok) {
                this.failureCount++;
                console.log(`Failed to get game state ${this.failureCount} times`);
                if (this.failureCount >= this.maxFailures) {
                    console.log(`Stopping polls after ${this.maxFailures} failures`);
                    this.stopPolling();
                }
            }
            // Reset failure count on success
            this.failureCount = 0;
            const newState = await response.json();
            this.state = newState;
            this.currentUser = newState.currentUser;
            window.gameState = newState;
            // update any 'PageElement' objects we have instantiated
            for (let pe of this.pageElements) {
                pe.update(newState);
            }
            // fire an event in case anythiing is listening
            window.dispatchEvent(new CustomEvent('gameStateUpdated', {
                detail: newState
            }));
            return newState;
        } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.maxFailures) {
                this.stopPolling();
            }
            return this.state;
        }
    }

    isQuestionActive() {
        let cq = this.getCurrentQuestion();
        if (!cq) {return false;}
        if (cq.timeLeft && cq.timeLeft > 0) {return true;}
        return false
    }

    getPlayers() {
        // first check if we have this member variable
        let s = this.state;
        // try the dom
        if (!s) {s = window.gameState}
        // ok error!
        if (!s) {return null;}
        if (!s.players) {return null;}
        return s.players;
    }

    getCurrentUser() {
        // first check if we have this member variable
        let s = this.state;
        // try the dom
        if (!s) {s = window.gameState}
        // ok error!
        if (!s) {return null;}
        if (!s.currentUser) {return null;}
        return s.currentUser;
    }

    /**
     * returns the current question if it is set, null otherwise
     */
    getCurrentQuestion() {
        // first check if we have this member variable
        let s = this.state;
        // try the dom
        if (!s) {s = window.gameState}
        // ok error!
        if (!s) {return null;}
        if (!s.currentQuestion) {return null;}
        return s.currentQuestion;
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
        this.pollInterval = setInterval(() => this.getGameState(), interval);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
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

    async submitAnswer() {
        let cq = this.getCurrentQuestion()
        // If we're not counting down then you can't submit
        /*
        if (!cq || !cq.timeLeft || cq.timeLeft <= 0) {
            return
        }
        */
        // work out what and where the answer is based on
        // what the current question is
        let questionType = cq?.type ?? 'unknown';
        let answer;  // <-- Add this line to declare the variable

        if (questionType === 'geolocation') {
            // get the answer from the click map
            answer = this.clickMap.getAnswer();
        } else if (questionType === 'multichoice') {
            // get the answer from the multichoice object
            answer = this.multiChoice.getAnswer();
        } else {
            // get the answer from the text input
            answer = document.getElementById('answer-input').value;
        }

        if (!answer) {
            console.log("no answer provided.. no points");
            // add zero points for this user for this question
            return;
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            await this.getGameState();
        } catch (error) {
            console.error('Failed to submit answer:', error);
        }
    }

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
            await this.getGameState();
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

// ###################################################################
// UI functions - update some universal page items
// ###################################################################

// *******************************
// ************ OBSERVER *********
// *******************************


// *******************************
// ************ HOST *************
// *******************************

// *******************************
// ************ PAGE ELEMENT *****
// *******************************

class PageElement {
    constructor(name, questionTypes) {
        this.element = null;
        this.styles = null;
        this.name = name;
        this.styleId = name + '-style';
        this.questionTypes = []
        if (questionTypes && Array.isArray(questionTypes)) {
            this.questionTypes = questionTypes;
        }
    }
    /**
     * Finds the dom element managed by this object in the current
     * dom model, or creates and inserts it.
     * Once found or created, caches it locally to prevent constant
     * dom searches
     * @returns the dom element that this object manages
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
     * @returns void
     */
    createElement() { return null;}
    /**
     * Convenience method for getting the GameAPI instance
     * @returns the GameAPI instance
     */
    getGameState() {return GameAPI.getInstance()}
    /**
     * Convenience method for getting the current Question object
     * from the game state
     * @returns the current question object
     */
    getCurrentQuestion() {return this.getGameState().getCurrentQuestion();}
    /**
     * Concenience method for getting the current players map
     * @returns the current players map
     */
    getPlayers() {return this.getGameState().getPlayers()}

    /**
     * returns true if the dom element that this object manages should be
     * updated. First checks
     * 1) dom element exists (returns false if not)
     * 2) current question exists (returns false if not)
     * 3) this object should even be shown on the page
     * finally calls shouldUpdate which can be overriden by the extending class
     * @returns bool true if this object should update the dom element it manages
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
     * @returns bool default true
     */
    shouldUpdate() {return true;}
    /**
     * Buffers the update of the dom element managed by this object
     * Calls getContent to get the new content of the dom element
     * then calls applyUpdate to actually update the main dom element
     * @param {*} gameState the current GameAPI
     * @returns void
     */
    update(gameState) {
        let cn = this.constructor.name
        if (!this.doShouldUpdate()) {
            return;
        }
        this.getStyles();
        console.log("updating " + cn)
        let o = this.getContent(gameState)
        this.applyUpdate(o);
    }
    /**
     * Uses animation frame to replace the content of the managed
     * element without flickering etc.
     * @param {*} o page element or elements
     * @returns null
     */
    applyUpdate(content) {
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
     * @param {*} gameState the current GameAPI
     */
    getContent(gameState) {}
    /**
     * Calls createStyles to create any css styles required
     * buy the dom object managed by this object.
     * Once createStyles has run, the response is cached locally
     * so that the dom doesn't get repeatedly searched.
     * If you wish to do something dynamic with styles you can
     * set this.styles=null and createStyles will be re-called
     * @returns
     */
    getStyles() {
        if (this.styles) {return;}
        const existingStyle = document.getElementById(this.styleId);
        if (existingStyle) {
            this.styles = existingStyle;
            return
        }
        let foo = this.createStyles();
        if (!foo) {
            this.styles = 'nostyles';
            return null;
        } else {
            this.styles = foo;
        }
    }
    /**
     * should be overriden to Create a dom style element
     * which implements the css required by this dom element
     * if any is required. If not, return null
     * @returns document.createElement('style')
     */
    createStyles() {return null;}

    /**
     * hides or shows the dom element managed by this object
     * based on some logic.
     * 1) The element is present in the dom
     * 2) the current question is not none
     * 3) this.shouldShow returns true or false
     *
     * @returns bool
     */
    doShouldShow() {
        if (!this.getElement()) {return false;}
        let cq = this.getCurrentQuestion()
        let t = cq.type
        if (!cq) {return false;}
        let qt = this.questionTypes
        // Check if this PageElement supports the current game type
        if (qt && Array.isArray(qt) && !qt.includes("*")) {
            if (!qt.includes(cq.type)) {
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
     * Should be overriden to determine if this dom element should
     * be hidden or shown based on some logic. Default true
     * @returns bool true if the dom element should be visible
     */
    shouldShow() {return true;}

    show() {
        let el = this.getElement()
        if (!el) {return;}
        el.style.visibility = 'visible';
        el.style.display = 'block';
    }

    hide() {
        let el = this.getElement()
        if (!el) {return;}
        el.style.visibility = 'hidden';
        el.style.display = 'none';
    }
}

// ###################################################################
// QUESTION
// ###################################################################

class QuestionView extends PageElement {
    constructor() {
        super('question-title', ['*'])
    }
    getContent(gs) {
        let cq =this.getCurrentQuestion();
        if (!cq) {return;}
        let s = cq.questionNumber + ') ' + cq.question
        let ret = document.createTextNode(s);
        return ret;
    }
}

// ###################################################################
// STREETVIEW
// ###################################################################

class StreetView extends PageElement {
    constructor() {
        super('streetview-container', ['geolocation']);
        this.baseUrl = "https://www.google.com/maps/embed?pb=";
        this.container = null;
        this.iframe = null;
        this.url = null;
    }

    update(gs) {
        super.update(gs)
    }

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
        let container = this.getElement()
        container.style.overflow = 'hidden';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.width = '100%';
        container.style.height = '100%';
        return super.createStyles();
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

    getContent() {
        let cq = this.getCurrentQuestion()
        this.imagePath = cq.clickImage;
        let rawSvg = this.getGameState().getFileContent(this.imagePath);
        if (!rawSvg) {
            console.error('Error loading SVG:', error);
            return null;
        }
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(rawSvg, 'image/svg+xml');
        const originalSvg = svgDoc.documentElement;
        // Get dimensions from the original SVG
        this.imageWidth = parseFloat(originalSvg.getAttribute('width') || originalSvg.viewBox.baseVal.width);
        this.imageHeight = parseFloat(originalSvg.getAttribute('height') || originalSvg.viewBox.baseVal.height);
        // Copy the original SVG directly
        this.svg = originalSvg;
        // Set SVG to fill container completely
        this.svg.style.width = "100%";
        this.svg.style.height = "100%";
        this.svg.style.display = "block"; // Removes any inline spacing
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); // Ensures proper scaling
        if (!this.svg.hasAttribute('viewBox')) {
            this.svg.setAttribute("viewBox", `0 0 ${this.imageWidth} ${this.imageHeight}`);
        }
        // Initialize events after adding to DOM
        this.initializeEvents();
        return this.svg
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

        console.log(`Distance: ${dt}, Max Error: ${maxError}, Points: ${a.points}`);

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

        console.log(`marker X: ${this.answerx}, marker Y: ${this.answery}`);

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
            console.log("mouse left area")
        });

        container.addEventListener('mouseup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.clearInterval()
            if (!this.svg) return;
            // mouse up go back to ordinary mouse pointer
            container.style.cursor = 'default';
            if (this.isDragging) {
                console.log("exiting draggin")
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
                console.log("dx " + dx + ": dy " + dy)
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
class CurrentAnswers extends PageElement {

    constructor(divName) {
        super('current-answers-div',['*'])
    }

    createStyles() {
        const styleElement = document.createElement('style');
        styleElement.id = this.styleId;
        const cssRules = `
            .table-title-bar {
                background-color: var(--bccblue);
                color: white;
                padding: 10px;
                font-weight: bold;
                border-radius: 4px 4px 0 0;
                margin-bottom: 0;
            }
            .score-table {
                margin-top: 0;
                border: 1px solid var(--bccblue);
                border-top: none;
                border-radius: 0 0 4px 4px;
            }
        `;
        styleElement.textContent = cssRules;
        document.head.appendChild(styleElement);
    }

    getContent() {
        // Create temporary container
        const tempContainer = document.createElement('div');

        // Get game state and validate
        const gs = this.getGameState();
        if (!gs || !gs.getCurrentQuestion()) {
            return;
        }

        // Build current answers table
        const currentAnswersTable = document.createElement('div');
        currentAnswersTable.id = 'current-answers-div';

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

        const players = gs.getPlayers();
        for (const [username, player] of Object.entries(players)) {
            if (player.isSpectator || player.isAdmin) continue;

            const hasAnswered = gs.hasAnswered(username);
            const rowStyle = hasAnswered ? '' : 'style="background-color: #f0f0f0;"';
            const playerAnswer = gs.getCurrentQuestion().answers.find(a => a.username === username);

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
        currentAnswersTable.innerHTML = answersHtml;
        tempContainer.appendChild(currentAnswersTable);

        // Build leaderboard section
        const leaderboardSection = document.createElement('div');

        // Create and add the title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = "Overall Leaderboard";
        leaderboardSection.appendChild(titleBar);

        // Create table
        const table = document.createElement('table');
        table.id = 'leaderboard';
        table.className = 'score-table';

        // Create header row
        const header = document.createElement('tr');
        ['Player', 'Score', '%'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            header.appendChild(th);
        });
        table.appendChild(header);
        leaderboardSection.appendChild(table);
        tempContainer.appendChild(leaderboardSection);

        // Fetch leaderboard data
        fetch('/api/get-leaderboard')
            .then(response => response.json())
            .then(players => {
                players.forEach(player => {
                    const row = document.createElement('tr');

                    const cells = [
                        player.username || 'Unknown',
                        player.score || 0,
                        player.percent === undefined || player.percent === null ? '?' : player.percent
                    ];

                    cells.forEach(text => {
                        const td = document.createElement('td');
                        td.textContent = text;
                        row.appendChild(td);
                    });

                    table.appendChild(row);
                });

                // Get the target element
                const targetElement = this.getElement();
                if (!targetElement) return;
                return tempContainer.children;
            })
            .catch(error => {
                console.error('Failed to fetch leaderboard:', error);
            });
    }
}


class Leaderboard extends PageElement {
    constructor() {
        super('leaderboard-div',['*'])
    }

    update() {
        // Create temporary container
        const tempContainer = document.createElement('div');

        // Get game state and validate
        const gs = this.getGameState();
        if (!gs || !gs.getCurrentQuestion()) {
            return;
        }

        // Build current answers table
        const currentAnswersTable = document.createElement('div');
        currentAnswersTable.id = 'current-answers-div';

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

        const players = gs.getPlayers();
        for (const [username, player] of Object.entries(players)) {
            if (player.isSpectator || player.isAdmin) continue;

            const hasAnswered = gs.hasAnswered(username);
            const rowStyle = hasAnswered ? '' : 'style="background-color: #f0f0f0;"';
            const playerAnswer = gs.getCurrentQuestion().answers.find(a => a.username === username);

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
        currentAnswersTable.innerHTML = answersHtml;
        tempContainer.appendChild(currentAnswersTable);

        // Build leaderboard section
        const leaderboardSection = document.createElement('div');

        // Create and add the title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = "Overall Leaderboard";
        leaderboardSection.appendChild(titleBar);

        // Create table
        const table = document.createElement('table');
        table.id = 'leaderboard';
        table.className = 'score-table';

        // Create header row
        const header = document.createElement('tr');
        ['Player', 'Score', '%'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            header.appendChild(th);
        });
        table.appendChild(header);
        leaderboardSection.appendChild(table);
        tempContainer.appendChild(leaderboardSection);

        // Fetch leaderboard data
        fetch('/api/get-leaderboard')
            .then(response => response.json())
            .then(players => {
                players.forEach(player => {
                    const row = document.createElement('tr');

                    const cells = [
                        player.username || 'Unknown',
                        player.score || 0,
                        player.percent === undefined || player.percent === null ? '?' : player.percent
                    ];

                    cells.forEach(text => {
                        const td = document.createElement('td');
                        td.textContent = text;
                        row.appendChild(td);
                    });

                    table.appendChild(row);
                });

                // Get the target element
                const targetElement = this.getElement();
                if (!targetElement) return;

                // Use requestAnimationFrame for smooth swap
                requestAnimationFrame(() => {
                    targetElement.replaceChildren(...tempContainer.children);
                });
            })
            .catch(error => {
                console.error('Failed to fetch leaderboard:', error);
            });
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
        let gs = this.getGameState();
        if (!gs.isQuestionActive()) {
            return false;
        }
        return true;
    }

    createStyles() {
        const styleElement = document.createElement('style');
        styleElement.id = this.styleId;

        const cssRules = `
            .timer {
                position: fixed;
                top: 10px;          /* Match top-qr positioning */
                left: 5vw;          /* Mirror the right positioning of top-qr */
                width: 18vw;        /* Match top-qr width */
                aspect-ratio: 1;    /* Make it square like top-qr */
                padding: 10px;
                border-radius: 4px;
                font-size: 5vw;
                z-index: 1000;      /* Keep it above other elements */
                text-align: center;
                font-family: 'Seg', 'Share Tech Mono', monospace;
                background-color: #000;
                color: #ff0000;     /* Classic red LED color */
                border: 1px solid #333;
                letter-spacing: 2px;
                display: flex;
                justify-content: center;
                align-items: center;
                box-shadow:
                    inset 0 0 8px rgba(255, 0, 0, 0.2),
                    0 0 4px rgba(255, 0, 0, 0.2);
                background: linear-gradient(
                    to bottom,
                    #000000,
                    #1a1a1a
                );
            }

            /* Add subtle reflection effect */
            .timer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 50%;
                background: linear-gradient(
                    rgba(255, 255, 255, 0.1),
                    rgba(255, 255, 255, 0)
                );
                border-radius: 2px;
                pointer-events: none;
            }
        `;

        styleElement.textContent = cssRules;
        return styleElement;
        //document.head.appendChild(styleElement);
    }

    getContent(gs) {
        let ret = null;
        let cq = this.getCurrentQuestion();
        const timeLeft = cq.timeLeft;
        if (timeLeft !== undefined && timeLeft !== null) {
            ret = document.createTextNode(timeLeft);
        }
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

        this.bindMethods();
        this.setupButton();
    }

    bindMethods() {
        this.handleClick = this.handleClick.bind(this);
        this.isEnabled = this.isEnabled.bind(this);
        this.buttonAction = this.buttonAction.bind(this);
    }

    createStyles() {
        const styleElement = document.createElement('style');
        styleElement.id = this.styleId;

        const cssRules = `
            .btn {
                display: inline-block;
                position: relative;
                color: white;
                font-size: 18px;
                padding: 1em;
                cursor: pointer;
                background: #4f95da;
                border: 1px solid #91c9ff;
                border-radius: 5px;
                outline: none;
                transition: all 0.3s ease-in-out;
            }

            .btn:hover:not(.button-disabled):not(.button-cooldown) {
                background: #91c9ff;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }

            .btn:active:not(.button-disabled):not(.button-cooldown) {
                transform: translateY(0);
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }

            .button-flash {
                animation: flash 0.5s ease-in-out;
            }

            .button-disabled, .button-cooldown {
                opacity: 0.65;
                cursor: not-allowed !important;
                background-color: #808080 !important;
                color: #ccc !important;
                border-color: #999 !important;
                transform: none !important;
                box-shadow: none !important;
                pointer-events: all !important; /* Ensure hover still works */
            }

            .button-disabled:hover, .button-cooldown:hover {
                opacity: 0.65;
                cursor: not-allowed !important;
            }

            @keyframes flash {
                0% {
                    transform: scale(1);
                    background-color: #4f95da;
                }
                50% {
                    transform: scale(1.1);
                    background-color: #91c9ff;
                }
                100% {
                    transform: scale(1);
                    background-color: #4f95da;
                }
            }
        `;

        styleElement.textContent = cssRules;
        document.head.appendChild(styleElement);
    }

    setupButton() {
        const button = this.getElement();
        if (!button) {
            // console.error(`Button element with id ${this.name} not found`);
            return;
        }
        button.classList.add('btn');
        button.addEventListener('click', this.handleClick);
    }

    handleClick(e) {
        const button = this.getElement();
        if (!button || !this.isEnabled() || button.classList.contains('button-cooldown')) {
            return;
        }

        // Visual feedback - flash animation
        button.classList.add('button-flash');
        setTimeout(() => button.classList.remove('button-flash'), 500);

        // Start cooldown
        button.classList.add('button-cooldown');
        button.disabled = true;

        let timeLeft = this.COOLDOWN_TIME;
        const countdownInterval = setInterval(() => {
            timeLeft--;
            button.textContent = `Wait ${timeLeft}s`;

            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                button.textContent = this.originalText;
                button.classList.remove('button-cooldown');
                button.disabled = false;
            }
        }, 1000);

        this.buttonAction();
    }

    getContent(gs) {
    }

    applyUpdate(o) {
        button.title = isEnabled ? '' : this.getDisabledTooltip();
    }

    setEnabled(enabled) {
        const button = this.getElement();
        if (!button) return;

        if (enabled) {
            button.classList.remove('button-disabled');
            button.classList.remove('button-cooldown');
            button.disabled = false;
            button.title = ''; // Remove any tooltip
            button.textContent = this.originalText;
        } else {
            button.classList.add('button-disabled');
            button.disabled = true;
            // Add a tooltip explaining why it's disabled
            button.title = this.getDisabledTooltip();
        }
    }

    getDisabledTooltip() {
        // Can be overridden by specific button classes
        return 'This action is not available right now';
    }

    isEnabled() {
        return true;
    }

    buttonAction() {
        console.warn('buttonAction not implemented');
    }

}

// Example implementation for Next Question Button
class NextQuestionButton extends AnimatedButton {
    constructor() {
        super('next-question-button', 2); // 2 second cooldown
    }

    buttonAction() {
        fetch('/api/next-question')
            .catch(error => console.log('Failed to rotate to next question'));
    }
}

// Example implementation for Previous Question Button
class PreviousQuestionButton extends AnimatedButton {
    constructor() {
        super('previous-question-button', 2); // 2 second cooldown
    }

    buttonAction() {
        fetch('/api/previous-question')
            .catch(error => console.log('Failed to rotate to previous question'));
    }
}

// Example implementation for Start Question Button
class StartQuestionButton extends AnimatedButton {
    constructor() {
        super('start-question-button', 3); // 3 second cooldown
    }

    buttonAction() {
        fetch('/api/start-question')
            .catch(error => console.log('Failed to start game, will retry...'));
    }

    // Add isEnabled method
    isEnabled() {
        let gs = this.getGameState()
        if (gs.isQuestionActive()) {return false;}
        return true;
    }
}

// Example implementation for Start Question Button
class PauseQuestionButton extends AnimatedButton {
    constructor() {
        super('pause-question-button', 3); // 3 second cooldown
    }

    buttonAction() {
        fetch('/api/pause-question')
            .catch(error => console.log('Failed to pause game, will retry...'));
    }

    isEnabled() {
        // not enabled if game isn't running
        let gs = this.getGameState()
        if (!gs.isQuestionActive()) {return false;}
        return true;
    }
}

// Example implementation for Start Question Button
class StopQuestionButton extends AnimatedButton {
    constructor() {
        super('stop-question-button', 3); // 3 second cooldown
    }

    buttonAction() {
        fetch('/api/stop-question')
            .catch(error => console.log('Failed to stop game, will retry...'));
    }

    isEnabled() {
        let gs = this.getGameState()
        if (!gs.isQuestionActive()) {return false;}
        return true;
    }
}

class AnswerButton extends AnimatedButton {
    constructor() {
        super('answer-button', 5); // 5 second cooldown
    }

    buttonAction() {
        let gs = GameAPI.getInstance();
        gs.submitAnswer();
    }

    isEnabled() {
        let gs = this.getGameState()
        let cq = this.getCurrentQuestion()
        if (!gs.isQuestionActive()) {return false;}
        if (gs.hasAnswered()) {return false;}
        return true;
    }
}

// ###################################################################
// MULTICHOICE
// ###################################################################

class MultiChoice extends PageElement {
    constructor() {
        super('multi-choice-container',['multichoice'])
    }
    createStyles() {
        const styleElement = document.createElement('style');
        styleElement.id = this.styleId;
        const cssRules = `
        `;
        styleElement.textContent = cssRules;
        return styleElement;
        //document.head.appendChild(styleElement);
    }

    getContent(gs) {
        let ret = null;
        let cq = this.getCurrentQuestion();
        const timeLeft = cq.timeLeft;
        if (timeLeft !== undefined && timeLeft !== null) {
            ret = document.createTextNode(timeLeft);
        }
        return ret;
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