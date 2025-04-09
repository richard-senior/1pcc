// Example implementation for Start Question Button
class PauseQuestionButton extends AnimatedButton {
    constructor() {
        super('pause-question-button', 3); // 3 second cooldown
    }

    async buttonAction() {
        await fetch('/api/pause-question')
        .then(response => {
            if (!response.ok) {
                return false;
            }
            return true
        })
        .catch(error => {return false;});
    }
}