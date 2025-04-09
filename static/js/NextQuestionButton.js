// Example implementation for Next Question Button
class NextQuestionButton extends AnimatedButton {
    constructor() {
        super('next-question-button', 2);
    }

    async buttonAction() {
        await fetch('/api/next-question')
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