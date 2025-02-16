// static/js/main.js

// Game API Module
const GameAPI = {
    // Fetch current game state
    getGameState: async function() {
        try {
            const response = await fetch('/api/game-state');
            const data = await response.json();
            if (data.error) {
                console.error('Game state error:', data.error);
                if (data.error === 'Not authenticated') {
                    window.location.href = '/join';
                }
                return null;
            }
            return data;
        } catch (error) {
            console.error('Failed to fetch game state:', error);
            return null;
        }
    },

    // Submit an answer
    submitAnswer: async function(answer) {
        try {
            const response = await fetch('/api/submit-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ answer: answer })
            });
            const data = await response.json();
            if (data.error) {
                console.error('Submit answer error:', data.error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Failed to submit answer:', error);
            return false;
        }
    },

    // Update the UI with current game state
    updateUI: function(gameState) {
        if (!gameState) return;

        // Update question area
        const questionArea = document.getElementById('question-area');
        if (gameState.currentQuestion) {
            questionArea.innerHTML = `
                <h2>Question ${gameState.questionNumber} of ${gameState.totalQuestions}</h2>
                <p>${gameState.currentQuestion.Question}</p>
                <form id="answer-form">
                    <input type="text" id="answer-input">
                    <button type="submit">Submit Answer</button>
                </form>
            `;

            // Add submit handler to the new form
            document.getElementById('answer-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const answer = document.getElementById('answer-input').value;
                const success = await GameAPI.submitAnswer(answer);
                if (success) {
                    document.getElementById('answer-input').value = '';
                }
            });
        }

        // Update players list
        const playersList = document.getElementById('players-list');
        if (playersList) {
            playersList.innerHTML = '<h3>Players</h3><ul>' +
                Object.entries(gameState.players)
                    .map(([name, player]) => `
                        <li>${name} - Score: ${player.Score}</li>
                    `)
                    .join('') +
                '</ul>';
        }
    },

    // Start game polling
    startPolling: function(interval = 1000) {
        // Initial poll
        this.pollGameState();

        // Set up regular polling
        return setInterval(() => this.pollGameState(), interval);
    },

    // Poll game state and update UI
    pollGameState: async function() {
        const gameState = await this.getGameState();
        this.updateUI(gameState);
    }
};

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Start polling game state
    GameAPI.startPolling();
});
