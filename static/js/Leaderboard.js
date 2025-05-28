/**
 * Class that deals with displaying the current total player rankings
 */
class Leaderboard extends PageElement {
    constructor() {
        super('leaderboard-div',['*'])
        this.lastFetchTime = 0;
        this.fetchInterval = 5000; // 5 seconds between fetches
    }

    shouldShow() {return true;}

    shouldUpdate() {
        // Force update if we don't have leaderboard data yet
        const api = this.getApi();
        if (!api.leaderboard) {
            return true;
        }

        // Check if it's time to refresh the leaderboard data
        const now = Date.now();
        if (now - this.lastFetchTime > this.fetchInterval) {
            this.lastFetchTime = now;
            return true;
        }

        return false;
    }

    // Remove the async keyword - we'll handle the async operation differently
    getContent(gs) {
        let api = this.getApi();

        // Create container div
        const container = document.createElement('div');

        // Create and add title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = 'Current Standings';
        container.appendChild(titleBar);

        // If we don't have leaderboard data yet, trigger a fetch and show loading state
        if (!api.leaderboard) {
            // Trigger fetch but don't await it
            api.fetchLeaderboard().then(() => {
                // Force an update after fetch completes
                this.flags.updateHasRun = false;
                api.update();
            }).catch(error => {
                console.error('Fetch error:', error);
            });

            // Show loading state
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-indicator';
            loadingDiv.textContent = 'Loading leaderboard...';
            container.appendChild(loadingDiv);
            return container;
        }

        // Create table
        const t = document.createElement('table');
        let h = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Rating</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
        `;

        try {
            const players = api.leaderboard;

            for (const [username, player] of Object.entries(players)) {
                // Skip spectators and admin users
                if (player.isSpectator || player.isAdmin) continue;
                let pts = 0;
                if (player.score) {
                    pts = parseFloat(player.score).toFixed(1);
                }
                h += `
                    <tr>
                        <td>${player.username}</td>
                        <td>${player.percent}%</td>
                        <td>${pts}</td>
                    </tr>
                `;
            }
            h += `
                    </tbody>
                </table>
            `;
            t.innerHTML = h;
            container.appendChild(t);
            return container;
        } catch (error) {
            this.warn('Leaderboard: Error creating content:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = 'Error loading leaderboard data';
            container.appendChild(errorDiv);
            return container;
        }
    }
}
