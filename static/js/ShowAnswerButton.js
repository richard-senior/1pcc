class ShowAnswerButton extends AnimatedButton {
    constructor() {
        super('show-answer-button', 2);
    }

    async buttonAction() {
        await fetch('/api/show-answer')
            .then(response => {
                if (!response.ok) {
                    return false;
                }
                return true
            })
            .catch(error => {return false;});
    }

    isEnabled() {
        let cq = this.getCurrentQuestion()
        if (!cq) {return false;}
        return cq.isTimedOut;
    }
}