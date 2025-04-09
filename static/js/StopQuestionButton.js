class StopQuestionButton extends AnimatedButton {
    constructor() {
        super('stop-question-button', 3); // 3 second cooldown
    }

    async buttonAction() {
        await fetch('/api/stop-question')
        .then(response => {
            if (!response.ok) {
                return false;
            }
            return true
        })
        .catch(error => {return false;});
    }
}