/**
 * A PageElement that displays a small square box containing a countdown
 * indicating the time remaining for the user to answer the current question
 */
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