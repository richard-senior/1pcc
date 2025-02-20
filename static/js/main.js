class GameAPI {

    constructor() {
        if (GameAPI.instance) {return GameAPI.instance;}
        this.state = null;
        this.pollInterval = null;
        this.failureCount = 0;  // Add failure counter
        this.maxFailures = 1800;   // Maximum failures before stopping polls
        // Initialize the map
        this.clickMap = new ClickMap();
        this.streetView = new StreetView();
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
            window.gameState = newState;
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

    /**
     * returns the current question if it is set, null otherwise
     */
    getCurrentQuestion(gameState) {
        // first check if we have this member variable
        let s = this.state;
        // try the dom
        if (!s) {s = window.gameState}
        // were we passed it?
        if (!s && gameState) {s = gameState}
        // ok error!
        if (!s) {return null;}
        if (!s.currentQuestion) {return null;}
        return s.currentQuestion;
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

    async submitAnswer(answer) {
        try {
            const response = await fetch('/api/submit-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ answer: answer })
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

    async nextQuestion() {
        try {
            const response = await fetch('/api/next-question', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            await this.getGameState();
        } catch (error) {
            console.error('Failed to advance question:', error);
        }
    }

    async previousQuestion() {
        try {
            const response = await fetch('/api/previous-question', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            await this.getGameState();
        } catch (error) {
            console.error('Failed to go to previous question:', error);
        }
    }
}

// ###################################################################
// UI functions - update some universal page items
// ###################################################################

function updateAll(event) {
    //updateQR()
    updateQuestionTitle()
    updateClickmap()
    updateStreetView()
    updatePlayers(event);
    updateHost(event);
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
// ************ HOST *************
// *******************************

function updateHost(event) {
    // if this isn't the host page then just return
    const sgb = document.getElementById('start-question-button');
    if (!sgb) {return;}
    let gs = GameAPI.getInstance()
    if (!gs) {return;}
    if (!gs.currentQuestion?.timeStarted) {
        sgb.style.color = '#ff0000';
    } else {
        sgb.style.color = '#00ffff';
    }
}

/* handlers for button push on host.html page */
window.startQuestionButton = function() {
    fetch('/api/start-question').catch(error => console.log('Failed to start game, will retry...'));
}
window.nextQuestionButton = function() {
    fetch('/api/next-question').catch(error => console.log('Failed to rotate to next question'));
}
window.previousQuestionButton = function() {
    fetch('/api/previous-question').catch(error => console.log('Failed to rotate to previous question'));
}

// *******************************
// ************ PLAYERS **********
// *******************************

function updatePlayers(event) {
    const timerDiv = document.getElementById('timer');
    if (!timerDiv) {return;}
    let gs = event.detail;
    let cq = GameAPI.getInstance().getCurrentQuestion(gs);
    if (!cq) {
        console.warn("no question loaded!");
    } else {
        console.log("question loaded");
    }
    updateTimer(event.detail);

}

function updateTimer(gameState) {
    let cq = GameAPI.getInstance().getCurrentQuestion(gameState)
    if (!cq) {return;}

    const timerDiv = document.getElementById('timer');
    if (!timerDiv) {
        console.log("no timer div");
        return;
    }

    let progressIndicator = document.getElementById('timer-progress');
    let progressBar = document.getElementById('timer-bar');

    // If elements don't exist, create them
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'timer-bar';
        progressBar.id = 'timer-bar';

        progressIndicator = document.createElement('div');
        progressIndicator.className = 'timer-progress';
        progressIndicator.id = 'timer-progress';

        progressBar.appendChild(progressIndicator);
        timerDiv.appendChild(progressBar);
    }

    // Calculate time remaining
    let timeRemaining = 0;
    if (cq.timeLeft) {
        timeRemaining = cq.timeLeft;
    }

    let timeLimit = 200;
    let percentageComplete = 100;
    if (cq.TimeLimit) {
        timeLimit = cq.TimeLimit;
        percentageComplete = (timeRemaining / timeLimit) * 100;
    }

    // Set the width of the progress indicator
    progressIndicator.style.width = `${percentageComplete}%`;

    // Make sure the timer div is visible
    timerDiv.style.visibility = 'visible';
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
        if (!streetViewUrl) {
            console.error('No street view URL provided');
            return;
        }
        if (this.url && this.url == streetViewUrl) {
            return;
        }
        console.log("setting location in streetview")

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
        console.log(embedUrl)
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
        this.scale = 1;
        this.viewBox = { x: 0, y: 0, width: 1000, height: 500 };
        this.isDragging = false;
        this.startPoint = { x: 0, y: 0 };
        this.viewBoxStart = { x: 0, y: 0 };
        this.imagePath = '/static/images/worldmap.svg';
        this.svg = null;
        this.imageWidth = null;
        this.imageHeight = null;
    }

    setImage(imageUrl) {
        const container = document.getElementById('click-container');
        if (!container) {
            console.error('Could not find click-container div');
            return;
        }

        // Clear any existing content
        container.innerHTML = '';

        // Create SVG element with proper styling and event handling
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", "100%");
        this.svg.setAttribute("height", "100%");
        this.svg.setAttribute("viewBox", `0 0 ${this.viewBox.width} ${this.viewBox.height}`);
        this.svg.style.display = 'block'; // Prevents extra space issues

        // Create an image element within the SVG
        const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("width", "100%");
        image.setAttribute("height", "100%");
        image.setAttribute("href", imageUrl);
        image.setAttribute("preserveAspectRatio", "xMidYMid meet");

        // Add image to SVG and SVG to container
        this.svg.appendChild(image);
        container.appendChild(this.svg);

        // Initialize events after adding to DOM
        this.initializeEvents();

        // Make sure container is visible
        container.style.display = 'block';
        container.style.visibility = 'visible';
    }

    initializeEvents() {
        const container = document.getElementById('click-container');
        if (!container) return;

        // Click handler
        container.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.isDragging) {
                const coords = this.getClickCoordinates(e);
                if (coords) {
                    console.log('Clicked coordinates:', coords);
                }
            }
        });

        // Wheel handler for zoom
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.zoom(scaleFactor, mouseX, mouseY);
        }, { passive: false });

        // Mouse down handler for drag
        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.svg) return;

            this.isDragging = true;
            this.startPoint = {
                x: e.clientX,
                y: e.clientY
            };

            const box = this.svg.viewBox.baseVal;
            this.viewBoxStart = {
                x: box.x,
                y: box.y
            };
        });

        // Mouse move handler
        container.addEventListener('mousemove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.isDragging || !this.svg) return;

            const dx = e.clientX - this.startPoint.x;
            const dy = e.clientY - this.startPoint.y;

            const box = this.svg.viewBox.baseVal;
            const scale = box.width / this.svg.clientWidth;

            box.x = this.viewBoxStart.x - (dx * scale);
            box.y = this.viewBoxStart.y - (dy * scale);
        });

        // Mouse up handler
        const stopDragging = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDragging = false;
        };

        container.addEventListener('mouseup', stopDragging);
        container.addEventListener('mouseleave', stopDragging);
    }

    getClickCoordinates(event) {
        if (!this.imageWidth || !this.imageHeight) {
            console.error('Image dimensions not set');
            return null;
        }

        const container = document.getElementById('click-container');
        if (!container) {
            console.error('Container not found');
            return null;
        }

        const rect = container.getBoundingClientRect();
        const viewBox = this.svg.viewBox.baseVal;

        // Get click position relative to container
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        // Ensure click is within bounds
        if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
            console.warn('Click outside container bounds');
            return null;
        }

        // Calculate the scaling factor between container and viewBox
        const scaleX = viewBox.width / container.clientWidth;
        const scaleY = viewBox.height / container.clientHeight;

        // Convert click coordinates to viewBox space
        const viewBoxX = (clickX * scaleX) + viewBox.x;
        const viewBoxY = (clickY * scaleY) + viewBox.y;

        // Convert to normalized coordinates (0-1)
        const normalizedX = viewBoxX / this.viewBox.width;
        const normalizedY = viewBoxY / this.viewBox.height;

        // Ensure coordinates are within image bounds
        if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
            console.warn('Coordinates outside image bounds');
            return null;
        }

        // Convert to image coordinates
        return {
            x: Math.round(normalizedX * this.imageWidth),
            y: Math.round(normalizedY * this.imageHeight)
        };
    }

    zoom(scaleFactor, centerX, centerY) {
        if (!this.svg) {
            console.error('SVG element not initialized');
            return;
        }

        const newScale = this.scale * scaleFactor;

        // Limit zoom levels
        if (newScale < 0.5 || newScale > 5) return;

        // Calculate new viewBox values
        const box = this.svg.viewBox.baseVal;
        const centerPtX = centerX / this.svg.clientWidth * box.width + box.x;
        const centerPtY = centerY / this.svg.clientHeight * box.height + box.y;

        const newWidth = this.viewBox.width / scaleFactor;
        const newHeight = this.viewBox.height / scaleFactor;

        // Adjust viewBox to zoom around mouse position
        box.x = centerPtX - (centerX / this.svg.clientWidth) * newWidth;
        box.y = centerPtY - (centerY / this.svg.clientHeight) * newHeight;
        box.width = newWidth;
        box.height = newHeight;

        this.scale = newScale;
        this.svg.classList.toggle('zoomed', this.scale > 1);
    }
}

// ###################################################################
// GLOBAL
// ###################################################################

// Initialize appropriate UI when document is ready
let gui;
document.addEventListener('DOMContentLoaded', () => {
    // start the game API singleton if it hasn't already been started
    // This will also start pollling the server for game state updates
    const gameApi = GameAPI.getInstance();
    // register an event for when the poll completes
    window.addEventListener('gameStateUpdated', updateAll);
});