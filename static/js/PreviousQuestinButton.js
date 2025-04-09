// Example implementation for Previous Question Button
class PreviousQuestionButton extends AnimatedButton {
    constructor() {
        super('previous-question-button', 2); // 2 second cooldown
    }

    async buttonAction() {
        await fetch('/api/previous-question')
        .then(response => {
            if (!response.ok) {
                return false;
            }
            return true
        })
        .catch(error => {return false;});
    }

    isEnabled() {
        let a = super.isQuestionActive()
        return !a;
    }
}