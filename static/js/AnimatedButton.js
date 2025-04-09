
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