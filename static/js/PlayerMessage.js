/**
 * PageElement class that
 * Deals with showing the user a prompt or error messages etc
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