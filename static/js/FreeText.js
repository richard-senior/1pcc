class FreeText extends PageElement {
    constructor() {
        super('free-text-container', ['freetext']);
        this.textInput = null;
        this.container = null;
    }

    shouldUpdate() {
        if (!this.container) {return true;}
        return false;
    }

    createImageDiv(container) {
        if (!container) {return;}
        let cq = this.getCurrentQuestion();
        // If there's an image URL, create and add the image container
        if (cq.imageUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'free-text-image-container';
            imageContainer.id = "free-text-image-container";
            const image = document.createElement('img');
            image.src = cq.imageUrl;
            image.alt = 'Question Image';
            image.className = 'free-text-image';

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

    createInputArea(container) {
        if (!container) {return;}
        let a = this.getApi();

        const inputContainer = document.createElement('div');
        inputContainer.className = 'free-text-input-container';

        // Create text input
        this.textInput = document.createElement('input');
        this.textInput.type = 'text';
        this.textInput.id = 'free-text-input';
        this.textInput.className = 'free-text-input';
        this.textInput.placeholder = 'Type your answer here...';
        inputContainer.appendChild(this.textInput);
        container.appendChild(inputContainer);
    }

    getContent(api) {
        this.container = document.createElement('div');
        this.createImageDiv(this.container);
        this.createInputArea(this.container);
        return this.container;
    }

    createStyles() {
        const ret = `
            #free-text-container {
                padding: 15px;
                margin: 0 auto;
                visibility: visible !important;
            }

            .free-text-image-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto 20px auto;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .free-text-image {
                width: 100%;
                height: auto;
                display: block;
                object-fit: contain;
            }

            .free-text-input-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }

            .free-text-input {
                width: 100%;
                padding: 15px 20px;
                border: 2px solid var(--bccblue);
                border-radius: 8px;
                background: white;
                font-size: 16px;
                transition: all 0.2s ease;
            }

            .free-text-input:focus {
                outline: none;
                box-shadow: 0 0 0 2px rgba(var(--bccblue-rgb), 0.2);
            }

            .free-text-input::placeholder {
                color: #999;
            }
        `;
        return ret;
    }

    fuzzyMatch(str1, str2) {
        // Normalize strings: lowercase and remove extra spaces
        str1 = str1.toLowerCase().trim();
        str2 = str2.toLowerCase().trim();

        // Find the shortest and longest strings
        let shorter = str1.length <= str2.length ? str1 : str2;
        let longer = str1.length > str2.length ? str1 : str2;

        // Try to find the best partial match by sliding the shorter string
        // across the longer string
        let minDistance = Infinity;

        for (let i = 0; i <= longer.length - shorter.length; i++) {
            const substring = longer.substr(i, shorter.length);
            const distance = this.levenshteinDistance(shorter, substring);
            minDistance = Math.min(minDistance, distance);

            // Early exit if we find a perfect match
            if (minDistance === 0) break;
        }

        return minDistance;
    }

    // Separate the core Levenshtein distance calculation
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;

        let matrix = Array(len1 + 1);
        for (let i = 0; i <= len1; i++) {
            matrix[i] = Array(len2 + 1);
        }

        for (let i = 0; i <= len1; i++) {
            matrix[i][0] = i;
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,     // deletion
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j - 1] + 1  // substitution
                    );
                }
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Uses fuzzy logic to determine if the user has answered
     * the question adequately.
     * currentQuestion.penalisationFactor is used to tune 'how wrong'
     * User input can be and still be considered a correct answer
     * @see {PageElement#getAnswer()}
     * @returns {Object} the scored answer object
     */
    getAnswer() {
        const gs = this.getApi();
        let answer = gs.createAnswerObject();

        // Get the text input element
        const textInput = this.getElement().querySelector('input[type="text"]');
        if (!textInput) {return null;}

        // Get the text value and trim whitespace
        const textValue = textInput.value.trim();
        if (!textValue || textValue === "") {
            return null;
        }

        // Get the current question to access the correct answer
        const currentQuestion = gs.getCurrentQuestion();
        if (!currentQuestion || !currentQuestion.correctAnswers || !currentQuestion.penalisationFactor) {
            this.warn('FreeText: No correct answer available or missing penalisationFactor');
            return null;
        }
        let maxDistance = parseInt(currentQuestion.penalisationFactor);
        if (isNaN(maxDistance)) {
            this.warn('FreeText: penalisationFactor is not a number');
            return null;
        }
        if (maxDistance == 0) {
            if (currentQuestion.correctAnswers.includes(textInput)) {
                answer.points = currentQuestion.pointsAvailable;
            } else {
                answer.points = 0;
            }
            return answer;
        }
        for (const ca of currentQuestion.correctAnswers) {
            // Calculate the Levenshtein distance between user input and correct answer
            const distance = this.fuzzyMatch(
                textValue.toLowerCase(),
                ca.toLowerCase()
            );
            // console.info(`Levenshtein distance: ${distance}`);
            const maxLength = Math.max(textValue.length, ca.length);
            const similarity = 1 - (distance / maxLength);
            answer.comment = `Similarity: ${Math.round(similarity * 100)}%`;
            if (distance <= maxDistance) {
                this.info(`right answer.. pf = ${maxDistance} actual distance ${distance}`);
                answer.points = currentQuestion.pointsAvailable;
                answer.answer = ca;
                break;
            } else {
                answer.points = 0
                answer.answer = ca
            }
        }
        return answer;
    }
}