/**
 * Class that deals with displaying the current total player rankings
 */
class Leaderboard extends PageElement {
    constructor() {
        super('leaderboard-div',['*'])
    }

    getContent(gs) {
        let api = this.getApi();
        api.fetchLeaderboard()
        if (!api.leaderboard) {return;}
        //console.log(api.leaderboard);
        // Create container div
        const container = document.createElement('div');
        // Create and add title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'table-title-bar';
        titleBar.textContent = 'Current Standings';
        container.appendChild(titleBar);

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
            if (!players) {
                this.warn('Leaderboard: No players data available');
                return null;
            }

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
            return null;
        }
    }
}