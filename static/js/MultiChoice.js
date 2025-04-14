class MultiChoice extends PageElement {
    constructor() {
        super('multi-choice-container', ['multichoice']); // ensure lowercase
        this.isPlayableComponent = true;
        this.choices = null;
        this.selectedChoice = null;
    }

    /**
     * If this multichoice question has image content then load the image
     * into the main container div
     * @param {*} container the parent container we are going to populate
     * @returns null (amends the given container object)
     */
    createImageDiv(container) {
        if (!container) {return;}
        let cq = this.getCurrentQuestion();
        // If there's an image URL, create and add the image container
        if (cq.imageUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'multi-choice-image-container';
            imageContainer.id = "multi-choice-image-container";
            const image = document.createElement('img');
            image.src = cq.imageUrl;
            image.alt = 'Question Image';
            image.className = 'multi-choice-image';

            // Add loading state
            image.style.opacity = '0';
            image.style.transition = 'opacity 0.3s ease-in';
            // Show image when loaded
            image.onload = () => {
                image.style.opacity = '1';
            };
            // Handle loading errors
            image.onerror = () => {
                this.warn('Failed to load image:', cq.imageUrl);
                imageContainer.remove();
            };
            imageContainer.appendChild(image);
            container.appendChild(imageContainer);
        }
    }

    /**
     * Creates the actual multichoice radio button group dom elements
     * @param {*} container the parent container we are going to populate
     * @returns null (amends the given container object)
     */
    createButtons(container) {
        if (!container) {return;}
        let cq = this.getCurrentQuestion();
        let a = this.getApi();
        let currentAnswer = this.getCurrentAnswer();
        this.choices = cq.choices;

        const pc = document.createElement('div');
        pc.className = 'multi-choice-buttons-container';
        pc.id = "multi-choice-buttons-container";
        pc.role = 'radiogroup'; // Accessibility
        pc.setAttribute('aria-label', 'Answer choices');

        // Create a button for each choice
        cq.choices.forEach((choice, index) => {
            let img = choice.imgUrl;
            const button = document.createElement('button');
            button.id = choice.answer
            button.setAttribute('data-choice-index', index);
            button.className = 'multi-choice-button';
            button.innerHTML = choice.choice;
            button.setAttribute('role', 'radio'); // Accessibility
            button.setAttribute('aria-checked', 'false');

            if (img) {
                const i = document.createElement('img');
                i.src = img;
                i.style.height = '2em';
                i.style.width = 'auto';
                i.style.marginRight = '8px';
                button.appendChild(i);
            }

            if (currentAnswer) {
                if (button.id === currentAnswer.answer) {
                    button.classList.add('selected');
                    button.setAttribute('aria-checked', 'true');
                    button.disabled = true;
                    button.style.cursor = 'default';
                    button.classList.add('answered');
                    button.addEventListener('click', () => {});
                }
            } else {
                // Add click handler
                button.addEventListener('click', (e) => {
                    // Remove selected class from all buttons
                    container.querySelectorAll('.multi-choice-button').forEach(btn => {
                        btn.classList.remove('selected');
                        btn.setAttribute('aria-checked', 'false');
                    });

                    // Add selected class to clicked button
                    button.classList.add('selected');
                    button.setAttribute('aria-checked', 'true');
                    // make the button itself the selected answer
                    let answer = a.createAnswerObject();
                    answer.answer = button.innerHTML;
                    answer.comment = button.id;
                    this.selectedChoice = answer;
                });
            }
            pc.appendChild(button);
        });
        container.appendChild(pc);
    }

    getContent(api) {
        api = api || this.getApi();
        const cq = this.getCurrentQuestion();
        if (!cq || !cq.choices) {
            debug('MultiChoice: No question or choices available');
            return;
        }
        // Only update if choices have changed
        if (this.choices && api.compareArrays(this.choices, cq.choices)) {
            return;
        }
        this.choices = cq.choices;
        // Create main container
        const container = document.createElement('div');
        // populate the container
        this.createImageDiv(container);
        this.createButtons(container);
        return container;
    }

    // Add these styles to createStyles()
    createStyles() {
        const ret = `
            #multi-choice-container {
                padding: 15px;
                margin: 0 auto;
                visibility: visible !important; /* Force visibility */
            }

            .multi-choice-image-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto 20px auto;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .multi-choice-image {
                width: 100%;
                height: auto;
                display: block;
                object-fit: contain;
            }

            .multi-choice-buttons-container {
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: 100%;
                visibility: visible !important; /* Force visibility */
            }

            .multi-choice-main-container {
                display: flex;
                flex-direction: column;
                width: 100%;
                gap: 20px;
                padding: 20px;
            }

            .multi-choice-button {
                width: 100%;
                padding: 15px 20px;
                padding-left: 45px;
                border: 2px solid var(--bccblue);
                border-radius: 8px;
                background: white;
                cursor: pointer;
                text-align: left;
                font-size: 16px;
                transition: all 0.2s ease;
                position: relative;
                visibility: visible !important; /* Force visibility */
            }

            .multi-choice-button::before {
                content: '';
                position: absolute;
                left: 15px;
                top: 50%;
                transform: translateY(-50%);
                width: 20px;
                height: 20px;
                border: 2px solid var(--bccblue);
                border-radius: 50%;
                background: white;
                transition: all 0.2s ease;
            }

            .multi-choice-button.selected {
                background: var(--bccblue);
                color: var(--bccstone);
            }

            .multi-choice-button.selected::before {
                background: var(--bccstone);
                border-color: var(--bccstone);
            }

            .multi-choice-button.selected::after {
                content: '';
                position: absolute;
                left: 19px;
                top: 50%;
                transform: translateY(-50%);
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--bccblue);
            }

            .multi-choice-button:hover {
                background: var(--bccblue);
                color: white;
            }
            .multi-choice-button.answered {
                opacity: 0.7;
                pointer-events: none;
                border-color: #ccc;
            }
            .multi-choice-button.answered::before {
                border-color: #ccc;
            }
        `;
        return ret;
    }

    disableButtons() {
        const buttons = document.querySelectorAll('.multi-choice-button');
        buttons.forEach(button => {
            button.disabled = true;
            button.style.cursor = 'default';
            button.classList.add('answered');
        });
        this.isAnswered = true;
    }

    getAnswer() {
        let answer = this.selectedChoice;
        if (!answer) {return null;}
        //calculate points
        let cq = this.getCurrentQuestion();
        let ca = cq.correctAnswers[0];
        // we have to use comment instead of answer field
        if (ca === answer.comment) {
            answer.points = cq.pointsAvailable;
            answer.comment = "yes";
        } else {
            answer.points = 0;
            answer.comment = "no";
        }
        this.disableButtons();
        return answer;
    }
}