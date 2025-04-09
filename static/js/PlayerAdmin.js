/**
 * PageElement Class which deals with displaying the current players
 * and allows for administration of those players
 */
class PlayerAdmin extends PageElement {
    constructor() {
        super('player-admin',['*'])
        this.numplayers = 0;
        this.totalPoints = 0;
    }

    static click(username, action) {
        if (!username || !action) {return;}
        let pts = document.getElementById("player-admin-points");
        let points = 0;
        if (pts) {points = pts.value;}
        GameAPI.sendHttpRequest(`/api/players?username=${username}&action=${action}&points=${points}`);
    }

    createStyles() {
        return `
        .small-button {
            padding: 2px 4px;
            font-size: 0.8em;
            margin: 1px;
            border-radius: 2px;
            border: 1px solid #ccc;
            color: var(--bccstone);
            background-color: var(--bcclightblue);
            cursor: pointer;
            min-width: min-content;
            height: auto;
            white-space: nowrap;
            display: inline-block;
            color: white;
        }

        .small-button:hover {
            background-color: var(--bccblue);
        }
        .small-button:active {
            background-color: var(--bccblue);
        }
        #player-admin-points {
            width: 100%;
            cursor: auto;
            font-size: 1em;
            color: var(--bccblue);
            background-color: var(--bccstone);
            border-radius: 2px;
            border: 1px solid var(--bcclightblue);
            padding: 0.5em;
        }
        `
    }

    shouldUpdate() {
        let players = this.getPlayers()
        // count total number of players
        let currentPlayerCount = Object.keys(players).length;
        if (currentPlayerCount === 0) {return false;}

        // Calculate total score across all players
        let totalScore = 0;
        for (const [username, player] of Object.entries(players)) {
            if (!player.isSpectator && !player.isAdmin) {
                totalScore += player.score;
            }
        }
        if (this.totalPoints === totalScore) {
            // have we got new players?
            if (currentPlayerCount === this.numplayers) {
                return false;
            } else {
                this.numplayers = currentPlayerCount;
                return true;
            }
        } else {
            this.totalPoints = totalScore;
            return true;
        }
    }

    getContent(gs) {
        // Get players using the existing GameAPI method
        const players = this.getPlayers();
        if (!players) {
            this.warn("No players available");
            return null;
        }
        // Create container div
        const container = document.createElement('div');
        // Create table
        const t = document.createElement('table');
        let h = `
            <form name="players-form" id="players-form" action="/api/players" method="GET"  autocomplete="off" accept-charset="UTF-8">
            <table class="table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Score</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        try {
            for (const [username, player] of Object.entries(players)) {
                if (player.isSpectator || player.isAdmin) continue;

                h += `
                    <tr>
                        <td>${username}</td>
                        <td>${player.score}</td>
                        <td>
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','surrender')" value="Surrender" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','kick')" value="Kick" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','ban')" value="Ban" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','dock')" value="Dock" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','award')" value="Award" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','msg')" value="Message" />
                            <input type="button" class="small-button" onclick="PlayerAdmin.click('${username}','rst')" value="Reset" />
                        </td>
                    </tr>
                `;
            }
            h += `
                    <tr>
                        <td colspan="3">
                            points/msg: <input type="text" name="player-admin-points" id="player-admin-points" value="" />
                        </td>
                    </tr>
                    </tbody>
                </table>
            </form>
            `;
            t.innerHTML = h;
            container.appendChild(t);
            return container;
        } catch (error) {
            this.warn('PlayerAdmin: Error creating content:', error);
            return null;
        }
    }
}