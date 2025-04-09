/**
 * The button used to submit answers on all question types
 */
class AnswerButton extends AnimatedButton {
    constructor() {
        super('answer-button', 5); // 5 second cooldown
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
}