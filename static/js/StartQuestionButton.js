// Example implementation for Start Question Button
class StartQuestionButton extends AnimatedButton {
    constructor() {
        super('start-question-button', 3); // 3 second cooldown
    }

    async buttonAction() {
        await fetch('/api/start-question')
        .then(response => {
            if (!response.ok) {
                this.warn("bad response from start question");
                return false;
            }
            debug("good response from start question");
            return true
        })
        .catch(error => {
            this.warn("error from start question", error);
            return false;
        });
    }

    isEnabled() {
        let a = super.isQuestionActive()
        return !a;
    }
}