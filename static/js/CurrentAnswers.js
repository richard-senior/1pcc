/**
 * PageElement Class which handle showing the observer which user has answered
 * and what they scored for the current question
 */
class CurrentAnswers extends PageElement {
    constructor() {
        super('current-answers-div', ['*']);
    }

    shouldShow() {
        const api = this.getApi();
        if (!api) {
            this.warn('CurrentAnswers: Could not get GameAPI instance');
            return false;
        }
        return api.hasAnyoneAnswered();
    }

    createStyles() {}

    getContent(gs) {
        // Get GameAPI instance
        const gameAPI = gs || this.getApi();
        // Create container div
        const container = document.createElement('div');
        // Create and add title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = 'Current Answers';
        container.appendChild(titleBar);

        // Check if anyone has answered
        const hasAnswers = gameAPI.hasAnyoneAnswered();
        if (!hasAnswers) {
            return null;
        }

        let t = document.createElement('table');
        let answersHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Answer</th>
                        <th>Points</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;

        try {
            const players = gameAPI.getPlayers();
            if (!players) {
                this.warn('CurrentAnswers: No players data available');
                return null;
            }

            for (const [username, player] of Object.entries(players)) {
                if (player.isSpectator || player.isAdmin) continue;
                const hasAnswered = gameAPI.hasAnswered();
                const rowStyle = hasAnswered ? '' : 'style="background-color: #f0f0f0;"';

                const currentQuestion = gameAPI.getCurrentQuestion();
                if (!currentQuestion || !currentQuestion.answers) {
                    this.warn('CurrentAnswers: No current question or answers available');
                    continue;
                }

                const playerAnswer = currentQuestion.answers.find(a => a.username === username);
                let pts = 0;
                if (playerAnswer && playerAnswer.points) {
                    pts = parseFloat(playerAnswer.points).toFixed(1);
                }
                answersHtml += `
                    <tr ${rowStyle}>
                        <td>${username}</td>
                        <td>${playerAnswer ? playerAnswer.answer : '...'}</td>
                        <td>${pts ? pts : '0'}</td>
                        <td>${playerAnswer ? playerAnswer.comment : 'timeout'}</td>
                    </tr>
                `;
            }

            answersHtml += `
                    </tbody>
                </table>
            `;
            t.innerHTML = answersHtml;
            container.appendChild(t);
            return container;
        } catch (error) {
            this.warn('CurrentAnswers: Error creating content:', error);
            return null;
        }
    }
}