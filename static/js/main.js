class GameAPI {

    constructor() {
        if (GameAPI.instance) {return GameAPI.instance;}
        this.state = null;
        this.currentUser = null;
        this.pollInterval = null;
        this.failureCount = 0;  // Add failure counter
        this.maxFailures = 1800;   // Maximum failures before stopping polls
        // Initialize the game type classes
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
        // add 'PageElement' objects to an array we can update on poll
        // TODO find any object implementing PageElement and add to array automatically
        this.pageElements = [this.timer,
            this.answerButton,
            this.startQuestionButton,
            this.pauseQuestionButton,
            this.stopQuestionButton,
            this.nextQuestionButton,
            this.previousQuestionButton
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
            // fire an event in case anythiing is listening
            window.dispatchEvent(new CustomEvent('gameStateUpdated', {
                detail: newState
            }));
            // update any 'PageElement' objects we have instantiated
            for (let pe of this.pageElements) {
                pe.doUpdate();
            }
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

    getCurrentUser(gameState) {
        // first check if we have this member variable
        let s = this.state;
        // try the dom
        if (!s) {s = window.gameState}
        // were we passed it?
        if (!s && gameState) {s = gameState}
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
}

// ###################################################################
// UI functions - update some universal page items
// ###################################################################

function updateAll(event) {
    let gs = GameAPI.getInstance()
    updateQuestionTitle()
    updateClickmap()
    updateStreetView()
    updateHost(event);
    updateObserver(event)
}

/* The current question title will appear in almost all views */
function updateQuestionTitle() {
    const qte = document.getElementById('question-title');
    if (!qte) {return;}
    let gs = GameAPI.getInstance().getCurrentQuestion();
    if (!gs) {
        console.log("no question loaded!");
        return;
    }
    let ret = gs.questionNumber + ') ' + gs.question
    qte.innerHTML = ret
}

function updateClickmap() {
    let gs = GameAPI.getInstance();
    let cq = gs.getCurrentQuestion();
    const gld = document.getElementById('click-container');
    if (!gld) {return;}

    let questionType = cq?.type ?? 'unknown';
    if (questionType === 'geolocation') {
        gld.style.visibility = 'visible';
        gld.style.display = 'block';
        let url = cq.clickImage;
        gs.clickMap.setImage(url);
    } else {
        gld.style.visibility = 'hidden';
        gld.style.display = 'none';
    }
}

function updateStreetView() {
    let gs = GameAPI.getInstance();
    let cq = gs.getCurrentQuestion();
    const gld = document.getElementById('streetview-container');
    if (!gld) {return;}

    let questionType = cq?.type ?? 'unknown';
    if (questionType === 'geolocation') {
        gld.style.visibility = 'visible';
        gld.style.display = 'block';
        let url = cq.streetView;
        gs.streetView.setLocation(url);
    } else {
        gld.style.visibility = 'hidden';
        gld.style.display = 'none';
    }
}

// *******************************
// ************ OBSERVER *********
// *******************************

function updateObserver(event) {
    let gs = GameAPI.getInstance()
    // first update the leaderboard
    let oo = gs.leaderboard
    oo.update();
}

// *******************************
// ************ HOST *************
// *******************************

function updateHost(event) {
    // if this isn't the host page then just return

}


// *******************************
// ************ PAGE ELEMENT *****
// *******************************

class PageElement {
    constructor(name) {
        this.name = name;
        this.styleId = name + '-style';
    }

    doGetElement() {
        let pe = document.getElementById(this.name);
        if (pe) {return pe;}
        return this.getElement();
    }

    getElement() {
        // should be overriden
        // if this PageElement should create its own
        // dom elements, then do so here and return it
        // if this PageElement is managing a dom element that
        // should already be defined in the html then return null
        return null;
    }

    getGameState() {
        return GameAPI.getInstance()
    }

    getCurrentQuestion() {
        return this.getGameState().getCurrentQuestion();
    }

    doShouldUpdate() {
        if (!this.doShouldShow()) {return false;}
        if (!this.doGetElement()) {return false;}
        if (!this.getCurrentQuestion()) {return false;}
        return this.shouldUpdate();
    }

    shouldUpdate() {
        // implement this
        return true;
    }

    doUpdate() {
        if (!this.doShouldUpdate()) {return;}
        this.doCreateStyles()
        this.update();
    }

    update() {
        // this should be overriden
    }

    doCreateStyles() {
        // Remove any existing style element with this ID
        const existingStyle = document.getElementById(this.styleId);
        if (existingStyle) {return;}
        this.createStyles();
    }

    createStyles() {
        // this should be overriden
        // EXAMPLE implementation below
        const styleElement = document.createElement('style');
        styleElement.id = this.styleId;

        // Define your CSS rules
        const cssRules = `
            .timer {
                position: fixed;
                top: 10px;          /* Match top-qr positioning */
                left: 5vw;          /* Mirror the right positioning of top-qr */
                width: 18vw;        /* Match top-qr width */
                aspect-ratio: 1;    /* Make it square like top-qr */
                padding: 10px;
                border-radius: 4px;
                font-size: 1.2em;
                z-index: 1000;      /* Keep it above other elements */
                text-align: center;
                font-family: 'Share Tech Mono', monospace;  /* Good for LED look */
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

        // Add the CSS rules to the style element
        styleElement.textContent = cssRules;

        // Add the style element to the document head
        document.head.appendChild(styleElement);
    }

    doShouldShow() {
        if (!this.doGetElement()) {return false;}
        if (!this.getCurrentQuestion()) {return false;}
        let ss = this.shouldShow();
        if (ss) {
            this.show();
            return true;
        } else {
            this.hide();
            return false;
        }
    }

    shouldShow() {
        // this should be overriden
        return true;
    }

    show() {
        if (!this.doGetElement()) {return;}
        this.doGetElement().style.visibility = 'visible';
        this.doGetElement().style.display = 'block';
    }

    hide() {
        if (!this.doGetElement()) {return;}
        this.doGetElement().style.visibility = 'hidden';
        this.doGetElement().style.display = 'none';
    }
}

// ###################################################################
// STREETVIEW
// ###################################################################

class StreetView {
    constructor() {
        this.baseUrl = "https://www.google.com/maps/embed?pb=";
        this.container = null;
        this.iframe = null;
        this.url = null;
    }

    setLocation(streetViewUrl) {
        if (this.url && this.url == streetViewUrl) {
            return;
        }
        if (!streetViewUrl) {
            console.error('No street view URL provided');
            return;
        }
        const embedUrl = this.baseUrl + streetViewUrl;
        this.url = streetViewUrl;

        this.container = document.getElementById('streetview-container');
        if (!this.container) {
            console.error('Street view container not found');
            return;
        }
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

    resize() {
        if (!this.isInitialized || !this.container) return;

        // Adjust iframe size to container
        const rect = this.container.getBoundingClientRect();
        this.iframe.style.width = `${rect.width}px`;
        this.iframe.style.height = `${rect.height}px`;
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.resize();
        }
    }
}

// ###################################################################
// CLICKABLE IMAGE
// ###################################################################

class ClickMap {

    constructor() {
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

    setImage(imageUrl) {
        if (this.imagePath && this.imagePath === imageUrl) {
            return;
        } else {
            this.imagePath = imageUrl;
        }

        const container = document.getElementById('click-container');
        if (!container) {
            console.error('Could not find click-container div');
            return;
        }

        // Clear any existing content
        container.innerHTML = '';
        // Clear any existing marker
        this.currentMarker = null;

        fetch(imageUrl)
            .then(response => response.text())
            .then(svgContent => {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
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

                // Set container styles to ensure proper filling
                container.style.overflow = 'hidden';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.width = '100%';
                container.style.height = '100%';

                if (!this.svg.hasAttribute('viewBox')) {
                    this.svg.setAttribute("viewBox", `0 0 ${this.imageWidth} ${this.imageHeight}`);
                }

                // Add SVG to container
                container.appendChild(this.svg);

                // Initialize events after adding to DOM
                this.initializeEvents();
            })
            .catch(error => {
                console.error('Error loading SVG:', error);
            });
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

    /**
     * Show all user answers on the map
     * TODO this!
     * @returns nothing
     */
    showUserAnswers() {
        let gs = GameAPI.getInstance();
        let cq = gs.getCurrentQuestion();
        let answers = cq.userAnswers;
        if (!answers) return;

        // Remove existing markers
        const existingMarkers = this.svg.querySelectorAll('circle');
        existingMarkers.forEach(marker => this.svg.removeChild(marker));

        // Add markers for each answer
        answers.forEach(answer => {
            const [x, y] = answer.answer.split(',').map(parseFloat);
            const circle = document.createElementNS("XXXXXXXXXXXXXXXXXXXXXXXXXX", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", this.markerSize / this.scale);
            circle.setAttribute("fill", "#24354f80");  // Blue with 50% opacity
            this.svg.appendChild(circle);
        });
    }

    initializeEvents() {
        const container = document.getElementById('click-container');
        if (!container) return;

        // Set default cursor
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

class Leaderboard {
    constructor() {
    }

    update() {
        this.updateCurrentQuestion();
        this.updateLeaderBoard();
    }

    updateCurrentQuestion() {
        let leaderboard = document.getElementById('current-answers-div');
        if (!leaderboard) return;

        // Create a temporary container
        let newContent = document.createElement('div');

        // Create and add the title bar
        let titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = "Current Question Scores";
        newContent.appendChild(titleBar);

        // get answers etc
        let gs = GameAPI.getInstance();
        let cq = gs.getCurrentQuestion();
        if (!cq) return;
        let answers = gs.getCurrentAnswers();
        if (!answers || answers.length < 1) return;

        // Create new table
        let table = document.createElement('table');
        table.id = 'current-answers';
        table.className = 'score-table';

        // Create header row
        let header = document.createElement('tr');
        let playerHeader = document.createElement('th');
        let scoreHeader = document.createElement('th');
        let notesHeader = document.createElement('th');

        playerHeader.textContent = 'Player';
        scoreHeader.textContent = 'Score';
        notesHeader.textContent = 'Notes';

        header.appendChild(playerHeader);
        header.appendChild(scoreHeader);
        header.appendChild(notesHeader);
        table.appendChild(header);

        // Add data rows
        for (let i = 0; i < answers.length; i++) {
            let answer = answers[i];
            let tr = document.createElement('tr');

            let playerCell = document.createElement('td');
            let scoreCell = document.createElement('td');
            let notesCell = document.createElement('td');

            playerCell.textContent = answer.username;
            scoreCell.textContent = answer.points;
            notesCell.textContent = answer.comment || ''; // Use empty string if comment is null/undefined

            tr.appendChild(playerCell);
            tr.appendChild(scoreCell);
            tr.appendChild(notesCell);
            table.appendChild(tr);
        }

        // Add table to our temporary container
        newContent.appendChild(table);

        // Only now replace the old content
        requestAnimationFrame(() => {
            leaderboard.replaceChildren(...newContent.children);
        });
    }

    updateLeaderBoard() {
        let leaderboard = document.getElementById('leaderboard-div');
        if (!leaderboard) return;

        // Create temporary container
        let newContent = document.createElement('div');

        // Create and add the title bar
        let titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = "Overall Leaderboard";
        newContent.appendChild(titleBar);

        // Create table
        let table = document.createElement('table');
        table.id = 'leaderboard';
        table.className = 'score-table';

        // Create header row
        let header = document.createElement('tr');
        let playerHeader = document.createElement('th');
        let scoreHeader = document.createElement('th');
        let percentHeader = document.createElement('th');

        playerHeader.textContent = 'Player';
        scoreHeader.textContent = 'Score';
        percentHeader.textContent = '%';

        header.appendChild(playerHeader);
        header.appendChild(scoreHeader);
        header.appendChild(percentHeader);
        table.appendChild(header);

        // Fetch leaderboard data
        fetch('/api/get-leaderboard')
            .then(response => response.json())
            .then(players => {
                players.forEach(player => {
                    let row = document.createElement('tr');

                    let nameCell = document.createElement('td');
                    let scoreCell = document.createElement('td');
                    let percentCell = document.createElement('td');

                    nameCell.textContent = player.username || 'Unknown';
                    scoreCell.textContent = player.score || 0;
                    let percentage = player.percentage;
                    if (player.percent === undefined || player.percent === null) {
                        percentCell.textContent = '?';
                    } else {
                        percentCell.textContent = player.percent
                    }
                    row.appendChild(nameCell);
                    row.appendChild(scoreCell);
                    row.appendChild(percentCell);
                    table.appendChild(row);
                });

                // Add table to temporary container
                newContent.appendChild(table);

                // Replace old content in one operation
                requestAnimationFrame(() => {
                    leaderboard.replaceChildren(...newContent.children);
                });
            })
            .catch(error => {
                console.error('Failed to fetch leaderboard:', error);
                console.error('Error details:', error.message);
            });
    }
}

// ###################################################################
// TIMER
// ###################################################################

class Timer extends PageElement {
    constructor() {
        super('timer');
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
        document.head.appendChild(styleElement);
    }

    update() {
        let td = this.doGetElement();
        if (!td) return;

        // Add the timer class to the element if it doesn't have it
        if (!td.classList.contains('timer')) {
            td.classList.add('timer');
        }

        let gs = this.getGameState();
        if (!gs) return;

        let cq = gs.getCurrentQuestion();
        if (!cq || !gs.isQuestionActive()) {
            td.style.visibility = 'hidden';
            td.style.display = 'none';
            return;
        }

        // Show the timer
        td.style.visibility = 'visible';
        td.style.display = 'flex';

        // Update the timer text
        const timeLeft = cq.timeLeft;
        if (timeLeft !== undefined && timeLeft !== null) {
            td.textContent = timeLeft;
        }
    }
}


// ###################################################################
// BUTTONS
// ###################################################################

// Base Button class for generic button animation and cooldown behavior
class AnimatedButton extends PageElement {

    constructor(elementId, cooldownTime = 5) {
        super(elementId);
        this.COOLDOWN_TIME = cooldownTime;
        this.originalText = this.doGetElement()?.textContent || '';

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
        const button = this.doGetElement();
        if (!button) {
            // console.error(`Button element with id ${this.name} not found`);
            return;
        }
        button.classList.add('btn');
        button.addEventListener('click', this.handleClick);
    }

    handleClick(e) {
        const button = this.doGetElement();
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

    update() {
        const button = this.doGetElement();
        if (!button) return;

        const isEnabled = this.isEnabled();
        this.setEnabled(isEnabled);

        // Update tooltip even when enabled
        button.title = isEnabled ? '' : this.getDisabledTooltip();
    }

    setEnabled(enabled) {
        const button = this.doGetElement();
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

class MultiChoice {
    constructor() {
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
    window.addEventListener('gameStateUpdated', updateAll);
});