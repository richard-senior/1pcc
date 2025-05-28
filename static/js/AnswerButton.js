/**
 * The button used to submit answers on all question types
 */
class AnswerButton extends AnimatedButton {
    constructor() {
        super('answer-button', 5); // 5 second cooldown
        this.lastQuestionActive = false;
        this.lastAnsweredState = false;
    }

    buttonAction() {
        let a = this.getApi()
        let success = a.submitAnswer();
        return success;
    }

    isEnabled() {
        let foo = super.isEnabled();
        if (!foo) {return false;}
        let answered = this.hasAnswered()
        if (answered) {return false;}
        return true;
    }

    /**
     * Override shouldUpdate to check if the question active state or answered state has changed
     * This ensures the button updates its visual state when these conditions change
     * @returns {boolean} true if the button should update
     */
    shouldUpdate() {
        const currentQuestionActive = this.isQuestionActive();
        const currentAnsweredState = this.hasAnswered();

        // Check if either state has changed
        if (currentQuestionActive !== this.lastQuestionActive ||
            currentAnsweredState !== this.lastAnsweredState) {

            // Update the stored states
            this.lastQuestionActive = currentQuestionActive;
            this.lastAnsweredState = currentAnsweredState;
            return true;
        }

        return false;
    }
}
