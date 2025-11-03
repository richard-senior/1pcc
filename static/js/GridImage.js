/**
 * A PageElement which implements an image which is overlayed with
 * a grid of elements (div's) into which answers can be dragged and dropped
 */
class GridImage extends PageElement {
    constructor() {
        super('grid-image-container', ['gridimage']);
        this.isPlayableComponent = true;
        this.gridSize = {
            rows: 5,
            cols: 4
        };
        this.selectedAnswers = new Map();
        this.draggedElement = null;
        this.lastQuestionActive = false;
    }

    shouldUpdate() {
        const currentQuestionActive = this.isQuestionActive();
        
        // Always update draggable states to keep them in sync
        this.updateDraggableStates();
        
        // Return true if state changed to trigger full update
        if (currentQuestionActive !== this.lastQuestionActive) {
            this.lastQuestionActive = currentQuestionActive;
            return true;
        }
        return false;
    }

    updateDraggableStates() {
        const draggables = document.querySelectorAll('.draggable-answer:not(.dragging)');
        const isActive = this.isQuestionActive();
        draggables.forEach(draggable => {
            if (isActive) {
                draggable.style.opacity = '1';
                draggable.style.cursor = 'move';
            } else {
                draggable.style.opacity = '0.5';
                draggable.style.cursor = 'not-allowed';
            }
        });
    }

    initialise(api) {
        let cq = api.getCurrentQuestion();
        if (cq.grid) {
            this.gridSize = {
                rows: cq.grid[0],
                cols: cq.grid[1]
            };
        }
    }

    createStyles() {
        return `
            .grid-image-container {
                display: flex;
                flex-direction: column;
                gap: 1em;
                padding: 0.5em;
            }

            .grid-board {
                display: grid;
                grid-template-columns: repeat(${this.gridSize.cols}, 1fr);
                grid-template-rows: repeat(${this.gridSize.rows}, 1fr);
                gap: 0.2em;
                background: var(--bccblue);
                padding: 1em;
                border: 1px solid var(--bcclightgold);
            }

            .grid-cell {
                background-color: rgba(255, 255, 255, 0.1);
                min-height: 100px;
                min-width: 100px;
                display: flex;
                justify-content: center;
                align-items: center;
                border: 1px solid var(--bcclightgold);
                position: relative;
                padding: 5px;
            }

            .answer-pool {
                display: flex;
                flex-wrap: wrap;
                gap: 0.1em;
                padding: 0.1em;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid var(--bcclightgold);
                justify-content: center;
            }

            .draggable-answer, .placed-answer {
                min-width: 150px;
                padding: 8px;
                background: var(--bccblue);
                border: 1px solid var(--bcclightgold);
                border-radius: 0.4em;
                color: white;
                cursor: move;
                user-select: none;
                transition: opacity 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .draggable-answer > div, .placed-answer > div {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                gap: 8px;
            }

            .draggable-answer.dragging {
                opacity: 0.4;
                border-radius: 6px;
            }

            .placed-answer {
                opacity: 0.8;
                background: var(--bccdarkgold);
                width: 90%;
            }

            .answer-image-container {
                flex-shrink: 0;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .answer-image-container img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }

            .draggable-answer span, .placed-answer span {
                font-size: 0.5rem;
                text-align: center;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
    }


    createImageDiv(container) {
        const cq = this.getCurrentQuestion();
        if (!cq) return;

        const gridBoard = document.createElement('div');
        gridBoard.className = 'grid-board';

        // First, let's determine the image dimensions
        if (cq.imageUrl) {
            const img = new Image();
            img.onload = () => {
                const aspectRatio = img.height / img.width;

                // Calculate the grid container dimensions to maintain aspect ratio
                const gridContainer = gridBoard.parentElement;
                const containerWidth = gridContainer.clientWidth;
                const desiredHeight = containerWidth * aspectRatio;

                // Update grid board style to maintain aspect ratio
                gridBoard.style.aspectRatio = `${img.width} / ${img.height}`;
                gridBoard.style.width = '100%';
                gridBoard.style.height = 'auto';
            };
            img.src = cq.imageUrl;
        }

        // Create grid cells
        for (let i = 0; i < this.gridSize.rows * this.gridSize.cols; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.cellIndex = i;

            if (cq.imageUrl) {
                cell.style.cssText = `
                    position: relative;
                    overflow: hidden;
                    background-image: url(${cq.imageUrl});
                    background-size: ${this.gridSize.cols * 100}% ${this.gridSize.rows * 100}%;
                    background-position: ${(i % this.gridSize.cols) * -100}% ${Math.floor(i / this.gridSize.cols) * -100}%;
                `;
            }

            // Add drop event listeners
            cell.addEventListener('dragover', e => e.preventDefault());
            cell.addEventListener('drop', (e) => this.handleDrop(e, cell));

            gridBoard.appendChild(cell);
        }

        container.appendChild(gridBoard);
    }

    createAnswerPool(container) {
        const cq = this.getCurrentQuestion();
        if (!cq || !cq.choices) return;

        const answerPool = document.createElement('div');
        answerPool.className = 'answer-pool';

        // Create draggable answers from choices
        cq.choices.forEach(choice => {
            const draggable = this.createDraggableAnswer(choice);
            answerPool.appendChild(draggable);
        });

        container.appendChild(answerPool);
    }

    createDraggableAnswer(choice) {
        const draggable = document.createElement('div');
        draggable.className = 'draggable-answer';
        draggable.dataset.answer = choice.answer;
        draggable.draggable = true;

        // Create a container for image and text to control layout
        const contentContainer = document.createElement('div');
        contentContainer.style.display = 'flex';
        contentContainer.style.alignItems = 'center';
        contentContainer.style.gap = '8px';

        if (choice.imgUrl) {
            // Create image container
            const imgContainer = document.createElement('div');
            imgContainer.className = 'answer-image-container';
            const img = document.createElement('img');
            img.src = choice.imgUrl;
            img.alt = choice.choice;
            imgContainer.appendChild(img);
            contentContainer.appendChild(imgContainer);
        }

        // Add text element
        const textSpan = document.createElement('span');
        textSpan.textContent = choice.choice;
        contentContainer.appendChild(textSpan);

        draggable.appendChild(contentContainer);

        draggable.addEventListener('dragstart', (e) => {
            // Don't allow dragging if question is not active
            if (!this.isQuestionActive()) {
                e.preventDefault();
                return;
            }
            
            this.draggedElement = draggable;
            draggable.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify({
                text: choice.choice,
                answer: choice.answer,
                imgUrl: choice.imgUrl
            }));
        });

        draggable.addEventListener('dragend', () => {
            this.draggedElement = null;
            draggable.classList.remove('dragging');
        });

        return draggable;
    }

    handleDrop(e, cell) {
        e.preventDefault();
        
        // Don't allow drops if question is not active
        if (!this.isQuestionActive()) {
            return;
        }
        
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const cellIndex = cell.dataset.cellIndex;

        // Check if there's an existing answer in this cell
        const existingAnswer = cell.querySelector('.placed-answer');
        if (existingAnswer) {
            // Create a new draggable answer in the pool from the existing answer
            const answerPool = this.container.querySelector('.answer-pool');
            const recycledAnswer = this.createDraggableAnswer({
                choice: existingAnswer.dataset.choice,
                answer: existingAnswer.dataset.answer,
                imgUrl: existingAnswer.dataset.imgUrl
            });
            answerPool.appendChild(recycledAnswer);
        }

        // Clear existing answer in this cell
        cell.textContent = '';

        // Create and add the new answer element
        const answerElement = document.createElement('div');
        answerElement.className = 'placed-answer';
        answerElement.dataset.answer = data.answer;
        answerElement.dataset.choice = data.text;
        answerElement.dataset.imgUrl = data.imgUrl || '';
        answerElement.draggable = true;

        // Create container for image and text
        const contentContainer = document.createElement('div');
        contentContainer.style.display = 'flex';
        contentContainer.style.alignItems = 'center';
        contentContainer.style.gap = '8px';

        if (data.imgUrl) {
            // Create image container
            const imgContainer = document.createElement('div');
            imgContainer.className = 'answer-image-container';
            const img = document.createElement('img');
            img.src = data.imgUrl;
            img.alt = data.text;
            imgContainer.appendChild(img);
            contentContainer.appendChild(imgContainer);
        }

        // Add text element
        const textSpan = document.createElement('span');
        textSpan.textContent = data.text;
        contentContainer.appendChild(textSpan);

        answerElement.appendChild(contentContainer);

        // Add drag events to placed answer
        answerElement.addEventListener('dragstart', (e) => {
            this.draggedElement = answerElement;
            answerElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify({
                text: data.text,
                answer: data.answer,
                imgUrl: data.imgUrl
            }));
        });

        answerElement.addEventListener('dragend', () => {
            this.draggedElement = null;
            answerElement.classList.remove('dragging');
        });

        cell.appendChild(answerElement);

        // Store the answer for this cell
        this.selectedAnswers.set(parseInt(cellIndex), {
            answer: data.answer,
            choice: data.text
        });

        // Handle removal of original element
        if (this.draggedElement && this.draggedElement.classList.contains('placed-answer')) {
            const originalCell = this.draggedElement.parentElement;
            if (originalCell && originalCell.classList.contains('grid-cell')) {
                originalCell.textContent = '';
                const originalCellIndex = parseInt(originalCell.dataset.cellIndex);
                this.selectedAnswers.delete(originalCellIndex);
            }
        } else if (this.draggedElement && this.draggedElement.parentElement.classList.contains('answer-pool')) {
            this.draggedElement.remove();
        }
    }

    getContent(api) {
        this.container = document.createElement('div');
        this.createImageDiv(this.container);
        this.createAnswerPool(this.container);
        
        // Set initial draggable states after a brief delay to ensure DOM is ready
        setTimeout(() => this.updateDraggableStates(), 0);
        
        return this.container;
    }

    getAnswer() {
        if (this.selectedAnswers.size === 0) return null;

        const answer = {
            answers: Array.from(this.selectedAnswers.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([_, entry]) => entry.answer)
        };

        // Create answer object using the API
        let a = this.getApi().createAnswerObject();
        a.answer = JSON.stringify(answer.answers);
        this.info(a.answer)

        let incorrect = [];
        // Calculate points based on correct answers
        const cq = this.getCurrentQuestion();
        if (cq.correctAnswers) {
            let correct = 0;
            answer.answers.forEach((item, index) => {
                if (cq.correctAnswers[index] === item) {
                    correct++;
                }
            });
            // Calculate points as a percentage of correct answers
            const percentage = correct / cq.correctAnswers.length;
            a.points = Math.round(cq.pointsAvailable * percentage);
            a.answer = `${correct} out of ${cq.correctAnswers.length}`;
            a.comment = '';
        }

        return a;
    }

    getAnswerContent(api) {
        // First get the base content
        let container = this.getContent(api);
        if (!container) {
            return null;
        }

        const cq = this.getCurrentQuestion();
        if (!cq || !cq.correctAnswers || cq.correctAnswers.length === 0) {
            this.info("No correct answers available");
            return container;
        }

        // Find the grid board
        const gridBoard = container.querySelector('.grid-board');
        if (!gridBoard) {
            this.warn("Grid board not found");
            return container;
        }

        // Get all grid cells
        const cells = gridBoard.querySelectorAll('.grid-cell');

        // Add correct answers to the grid
        cq.correctAnswers.forEach((correctAnswer, index) => {
            if (index < cells.length) {
                // Find the matching choice for this answer
                let matchingChoice = null;
                if (cq.choices) {
                    matchingChoice = cq.choices.find(choice => choice.answer === correctAnswer);
                }

                // Create a correct answer element
                const correctElement = document.createElement('div');
                correctElement.className = 'placed-answer';
                correctElement.style.cssText = `
                    background-color: rgba(0, 0, 0, 0.8);
                    border: 1px solid white;
                    position: relative;
                `;

                // Create container for content
                const contentContainer = document.createElement('div');

                // Add image if available
                if (matchingChoice && matchingChoice.imgUrl) {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'answer-image-container';
                    const img = document.createElement('img');
                    img.src = matchingChoice.imgUrl;
                    img.alt = matchingChoice.choice || correctAnswer;
                    imgContainer.appendChild(img);
                    contentContainer.appendChild(imgContainer);
                }

                // Add text
                const textSpan = document.createElement('span');
                textSpan.textContent = matchingChoice ? matchingChoice.choice : correctAnswer;
                textSpan.style.fontWeight = 'bold';
                contentContainer.appendChild(textSpan);

                correctElement.appendChild(contentContainer);

                // Clear any existing content in the cell
                cells[index].innerHTML = '';
                cells[index].appendChild(correctElement);
            }
        });

        // Remove the answer pool since we're showing answers
        const answerPool = container.querySelector('.answer-pool');
        if (answerPool) {
            answerPool.remove();
        }

        return container;
    }
}