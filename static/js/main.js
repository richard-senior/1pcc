class GameAPI {

    constructor() {
        if (GameAPI.instance) {return GameAPI.instance;}
        this.state = null;
        this.pollInterval = null;
        this.failureCount = 0;  // Add failure counter
        this.maxFailures = 1800;   // Maximum failures before stopping polls
        // Initialize the map
        this.clickMap = new ClickMap();
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
        let s = this.state;
        if (!s) {s = window.gameState}
        if (!s && !gameState) {s = gameState}
        if (!s) {return null;}
        return s.currentQuestion
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
// UI functions
// ###################################################################

function updateAll(event) {
    updatePlayers(event);
    updateHost(event);
}

// *******************************
// ************ HOST *************
// *******************************

function updateHost(event) {
    // if this isn't the host page then just return
    const sgb = document.getElementById('start-game-button');
    if (!sgb) {return;}
    if (!window.gameState.game_started) {
        sgb.style.color = '#ff0000';
    } else {
        sgb.style.color = '#00ffff';
    }
}

// start-game-button
window.startGameButton = function() {
    console.log("HANDLING START BUTTON CLICK")
    fetch('/api/start-question').catch(error => console.log('Failed to start game, will retry...'));
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
    updateGeoGuesser(event.detail);
    updateTimer(event.detail);

}

function updateGeoGuesser(gameState) {
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
        this.mapGroup = null;
    }

    setImage(imageUrl) {
        // Find the container
        const container = document.getElementById('click-container');
        if (!container) {
            console.error('Could not find click-container div');
            return;
        }

        // Clear any existing content
        container.innerHTML = '';

        // Create new image element
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.width = '100%';
        img.style.height = 'auto';

        // Optional: Add loading handler to ensure image is loaded before allowing clicks
        img.onload = () => {
            this.imageWidth = img.naturalWidth;
            this.imageHeight = img.naturalHeight;
        };

        // Add the image to container
        container.appendChild(img);

        // Reset any existing click data
        this.clicks = [];
        this.currentClick = null;

        // Initialize events if not already done
        if (!this.svg) {
            this.initializeEvents();
        }

        // Unhide the container
        container.style.display = 'block';
    }

    initializeEvents() {
        // Only initialize if we haven't already
        if (this.svg) return;

        const container = document.getElementById('click-container');
        if (!container) return;

        // Add click handler to the container instead of SVG
        container.addEventListener('click', (e) => {
            if (!this.isDragging) {
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                console.log('Clicked at:', { x, y });
            }
        });

        // Pan handlers
        this.svg.addEventListener('mousedown', (e) => {
            this.startDrag(e);
        });

        document.addEventListener('mousemove', (e) => {
            this.drag(e);
        });

        document.addEventListener('mouseup', () => {
            this.endDrag();
        });
    }

    getClickCoordinates(event) {
        const pt = this.svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;

        // Transform mouse coordinates to SVG coordinates
        const svgPoint = pt.matrixTransform(this.svg.getScreenCTM().inverse());

        return {
            x: svgPoint.x,
            y: svgPoint.y
        };
    }

    zoom(scaleFactor, centerX, centerY) {
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

    startDrag(event) {
        this.isDragging = true;
        this.startPoint = {
            x: event.clientX,
            y: event.clientY
        };
        this.viewBoxStart = {
            x: this.svg.viewBox.baseVal.x,
            y: this.svg.viewBox.baseVal.y
        };
    }

    drag(event) {
        if (!this.isDragging) return;

        const dx = (event.clientX - this.startPoint.x) * this.viewBox.width / this.svg.clientWidth;
        const dy = (event.clientY - this.startPoint.y) * this.viewBox.height / this.svg.clientHeight;

        this.svg.viewBox.baseVal.x = this.viewBoxStart.x - dx;
        this.svg.viewBox.baseVal.y = this.viewBoxStart.y - dy;
    }

    endDrag() {
        this.isDragging = false;
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