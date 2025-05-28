/**
 * PageElement which manages the display of the actual question
 * that is the text or otherwise which prompts the player for a response
 */
class QuestionView extends PageElement {
    constructor() {
        super('question-title', ['*'])
        this.questionNumber = -1;
    }

    shouldUpdate() {
        let cq = this.getCurrentQuestion();
        if (cq.questionNumber !== this.questionNumber) {
            this.questionNumber = cq.questionNumber;
            return true;
        }
        return false;
    }

    createStyles() {
        return `
            .question-title-container {
                width: 100%;
                border-collapse: collapse;
                background: transparent;
                border: 0;
                position: relative;
            }
            .question-title-container tr,
            .question-title-container td {
                background: transparent;
                border: 0;
                padding: 0;
                text-align: center;
            }
            .corner-image {
                position: absolute;
                top: 0;
                right: 0;
                width: 3em;
                height: 3em;
                z-index: 1000;  /* Increased z-index to ensure it's above other elements */
                cursor: pointer;
                transition: opacity 0.3s ease;  /* Smooth transition for opacity change */
                opacity: 0.6;  /* Initial state slightly transparent */
                pointer-events: auto;  /* Ensure the image receives mouse events */
            }
            .corner-image:hover {
                opacity: 1;  /* Full opacity on hover */
            }
            .username-row {
                color: var(--bcclightgold);
                font-size: 1.2em;
                font-weight: bold;
                position: relative;
                z-index: 2;
            }
            .percent-row {
                color: var(--bccdarkgold);
                font-size: 1.4em;
                font-weight: bold;
                position: relative;
                z-index: 2;
            }
            .question-row {
                color: white;
                font-size: 1.8em;
                position: relative;
                z-index: 2;
            }
        `;
    }

    async handleGiveUp() {
        const api = this.getApi();
        const success = await api.surrender();

        if (success) {
            // Provide visual feedback that the surrender was successful
            const cornerImage = document.querySelector('.corner-image');
            if (cornerImage) {
                // Visual indication that surrender was processed
                cornerImage.style.opacity = 0.3;
                cornerImage.style.cursor = 'default';
                cornerImage.title = "You've given up on this question";

                // Disable further clicks
                cornerImage.onclick = null;
                cornerImage.style.pointerEvents = 'none';
            }
        }
    }


    getContent(gs) {
        let cp = this.getCurrentPlayer();
        if (!cp) {return;}
        let cq = this.getCurrentQuestion();
        if (!cq) {return;}

        const container = document.createElement('div');
        container.style.position = 'relative';

        // Create the corner image
        const cornerImage = document.createElement('img');
        cornerImage.src = '/static/images/giveup.svg';
        cornerImage.title = "I give up!";
        cornerImage.className = 'corner-image';

        // Add click event listener
        cornerImage.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleGiveUp();
        });

        container.appendChild(cornerImage);

        // Create table
        const table = document.createElement('table');
        table.className = 'question-title-container';

        // Create username row
        const usernameRow = document.createElement('tr');
        const usernameCell = document.createElement('td');
        usernameCell.className = 'username-row';
        usernameCell.textContent = cp.username;
        usernameRow.appendChild(usernameCell);

        // Create percent row
        const percentRow = document.createElement('tr');
        const percentCell = document.createElement('td');
        percentCell.className = 'percent-row';
        percentCell.textContent = cq.percent.toString() + "% - " + cq.category;
        percentRow.appendChild(percentCell);

        // Create question row
        const questionRow = document.createElement('tr');
        const questionCell = document.createElement('td');
        questionCell.className = 'question-row';
        questionCell.innerHTML = `${cq.question}`;
        questionRow.appendChild(questionCell);

        // Add rows to table
        table.appendChild(usernameRow);
        table.appendChild(percentRow);
        table.appendChild(questionRow);

        container.appendChild(table);

        return container;
    }

}