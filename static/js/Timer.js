/**
 * A PageElement that displays a small square box containing a countdown
 * indicating the time remaining for the user to answer the current question
 */
class Timer extends PageElement {
    constructor() {
        super('timer',['*']);
        this.labelText = null;  // Will be set dynamically based on game state
        this.color = '#ff0000'; // Will be set dynamically based on game state
    }

    shouldShow() {
        // Show timer during read time or when question is active
        let gs = this.getGameState();
        if (!gs || !gs.currentQuestion) {return false;}
        return gs.isUserReading || this.isQuestionActive();
    }

    getContent(gs) {
        if (!gs || !gs.currentQuestion) {return null;}

        // Determine color and label based on game state
        if (gs.isUserReading) {
            // Read mode - amber/yellow
            this.color = '#ffaa00';
            this.labelText = 'GET READY';
        } else if (this.isQuestionActive()) {
            // Active mode - red
            this.color = '#ff0000';
            this.labelText = 'COUNTDOWN';
        } else {
            // Future: green mode can be added here
            return null;
        }

        const container = document.createElement('div');
        container.style.color = this.color; // Apply color dynamically

        // Add optional label if specified
        if (this.labelText) {
            const label = document.createElement('div');
            label.className = 'timer-label';
            label.textContent = this.labelText.substring(0, 10); // Max 10 chars
            container.appendChild(label);
        }

        // Add countdown number
        const timeDiv = document.createElement('div');
        timeDiv.className = 'timer-number';
        timeDiv.textContent = this.getTimeLeft();
        container.appendChild(timeDiv);

        return container;
    }

    createStyles() {
        const css = `
            #timer {
                position: fixed;    /* glue to window */
                display: flex;
                flex-direction: column;
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
                background-color: #000;
                border: 1px solid #333;
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

            #timer .timer-label {
                font-size: 0.5em;
                font-family: Arial, sans-serif;
                margin-bottom: 0.5em;
                letter-spacing: 1px;
            }

            #timer .timer-number {
                font-size: 1em;
                font-family: 'Seg', 'Share Tech Mono', monospace;
                letter-spacing: 2px;
            }
        `;
        return css;
    }

    shouldUpdate() {
        // Always update the timer to check state changes
        return true;
    }
}