/**
 * Class for holding the status of page elements.
 * Also provides some access methods etc.
 */
class PageElementFlags {
    constructor() {
        this.updateHasRun = false;
        this.initialisedHasRun = false;
        this.updateAnswerHasRun = false;
        this.answerSubmitted = false;
    }
    /**
     * @returns {bool} Returns true if any flags indicate that the PageElement should be initialised
     */
    isUninitialised() {return !this.initialisedHasRun;}
}
/**
 * The base type of all page elements
 * A pageElement is an object that manages the lifecycle and content of a html DOM element
 * Intended to be extended to provide various elements on the page such as buttons or images etc.
 * In general PageElement methods that begin with the word 'do' are private or internal methods intended to wrap around
 * methods that are expected to be overriden. For example 'doShouldUpdate' is intended to wrap
 * the 'shouldUpdate' method. So in general we do not directly call the 'shouldUpdate' method, instead we would call
 * 'doShouldUpdate' which in turn will call 'shouldUpdate' etc.

 * The exception to this is 'update' (which is the main method (entrypoint) of PageElement and is called on every poll
 * by the GameAPI). update() has no 'doUpdate()' to wrap it.
 */
class PageElement {
    /**
     * The application implements a quiz. The quiz gets its questions from a json file.
     * Questions vary. Some may involve simply entering some text, others might involve dragging page elements around.
     * The main types of question are 'kazakhstan, freetext, multichoice, gridimage and geolocation
     * If a page element may possibly be used by any question type then 'questionTypes' should contain '*'
     * Otherwise it should contain the names or name of any game types that use this page element
     * @param {string} name The name of this page element
     * @param {array[string]} questionTypes which question types this page element is associated with
     */
    constructor(name, questionTypes) {
        // event bindings
        this.boundOnNewQuestion = null;
        this.boundOnQuestionTimeout = null;
        this.boundOnAnswerSubmitted = null;
        // general
        this.classname = this.constructor.name;
        this.isPlayableComponent = false;
        this.element = null;
        this.styles = null;
        this.name = name;
        this.styleId = name + '-style';
        this.questionTypes = null;
        if (questionTypes) {
            if (Array.isArray(questionTypes)) {
                this.questionTypes = questionTypes;
            } else if (typeof questionTypes === 'string') {
                this.questionTypes = [questionTypes];
            }
        }
        this.flags = new PageElementFlags();
    }

    /**
     * Logs to console at info level after first checking whether it should do so
     * Prepends the log line with the name of the class that invoked this method
     * @param  {...any} args
     */
    info(...args) {
        switch (GameAPI.loggingType) {
            case 0:
                return;
            case 1:
                if (!GameAPI.logClassName || GameAPI.logClassName=="") {return;}
                if (this.classname != GameAPI.logClassName) {return;}
        }
        console.info(`${this.classname}:`, ...args);
    }
    /**
     * Logs to console at warn level after first checking whether it should do so
     * Prepends the log line with the name of the class that invoked this method
     * @param  {...any} args
     */
    warn(...args) {
        switch (GameAPI.loggingType) {
            case 0:
              return;
            case 1:
              if (!GameAPI.logClassName || GameAPI.logClassName=="") {return;}
              if (this.classname != GameAPI.logClassName) {return;}
        }
        console.warn(`${this.classname}:`, ...args);
    }

    /**
     * called during 'update' after complete construction of both
     * this page element and the game API itself.
     * Safe to use as a kind of secondary constructor which won't cause
     * stack overflows etc.
     * @param {*} api
     * @returns null
     */
    doInitialise(api) {
        if (this.flags.initialisedHasRun) {return;}
        let ca = api.getCurrentAnswer();
        if (ca) {
            this.selectedAnswer = ca;
        }
        this.initialise(api);
        this.flags.initialisedHasRun = true;
        //this.initialiseEvents();
    }

    /**
     * doInitialise is called during 'update' which sets a boolean that
     * we can check to see if we have run through update at least once
     * This can be used to determine if we should regenerate page elements etc.
     * @returns {boolean} true if this object has been initialised
     */
    isInitialised() {return this.flags.initialisedHasRun;}

    /**
     * Should be overriden to init anything in page elements that requires a
     * fully instantiated game state
     * @param {*} api the game state api
     */
    initialise(api) {}

    /**
     * Init various event handlers
     */
    initialiseEvents() {

        this.boundOnAnswerSubmitted = async (event) => {
            try {
                await this.onAnswerSubmitted(event);
            } catch (error) {
                this.warn(`Error in onAnswerSubmitted for ${this.constructor.name}:`, error);
            }
        };

        this.boundOnNewQuestion = async (event) => {
            try {
                await this.onNewQuestion(event);
            } catch (error) {
                this.warn(`Error in onNewQuestion for ${this.constructor.name}:`, error);
            }
        };

        this.boundOnQuestionTimeout = async (event) => {
            try {
                await this.onQuestionEnd(event);
            } catch (error) {
                this.warn(`Error in onQuestionEnd for ${this.constructor.name}:`, error);
            }
        };

        // Add event listeners
        window.addEventListener('answerSubmitted', this.boundOnAnswerSubmitted);
        window.addEventListener('questionChanged', this.boundOnNewQuestion);
        window.addEventListener('questionTimedOut', this.boundOnQuestionTimeout);
    }

    async onAnswerSubmitted(event) {
        // Base implementation does nothing
        return Promise.resolve();
    }

    /**
     * Base method for handling new question events
     * Extending classes should override this method using async/await pattern
     * @param {CustomEvent} event The question changed event
     */
    async onNewQuestion(event) {
        // Base implementation does nothing
        return Promise.resolve();
    }

    /**
     * Base method for handling question end events
     * Extending classes should override this method using async/await pattern
     * @param {CustomEvent} event The question timeout event
     */
    async onQuestionEnd(event) {
        // Base implementation does nothing
        return Promise.resolve();
    }

    /**
     * Finds the dom element managed by this object in the current
     * dom model, or creates and inserts it.
     * Once found or created, caches it locally to prevent constant
     * dom searches
     * @returns {Document.Object} the dom element that this object manages
     */
    getElement() {
        if (this.element) {return this.element;}
        let pe = document.getElementById(this.name);
        if (pe) {
            this.element = pe;
            return pe;
        }
        pe = this.createElement();
        if (pe) {
            this.element = pe;
            return pe;
        }
        this.element = null;
    }
    /**
     * Abstract method that should be overriden by the extending class
     * called when the dom element managed by this object doesn't already
     * exist in the page. Creates and inserts the dom element in the correct
     * page of the dom model
     * @returns {void}
     */
    createElement() {return null;}
    /**
     * Convenience method for getting the GameAPI instance
     * @returns {GameAPI} the GameAPI instance
     */
    getApi() {return GameAPI.getInstance();}
    /**
     * Convenience method for getting the current game state
     * @returns {Object} the current game state
     */
    getGameState() {return GameAPI.getGameState();}
    /**
     * Convenience method for getting the current Question object
     * from the game state
     * @returns {Question} the current question object
     */
    getCurrentQuestion() {return this.getApi().getCurrentQuestion();}
    /**
     * returns whatever answer the user entered for this question or null
     * @returns {object} the answer object or null
     */
    getCurrentAnswer() {return this.getApi().getCurrentAnswer();}
    /**
     * Convenience method for getting response from game state
     * @returns {boolean} the current GameAPI instance isQustionActive response
     */
    isQuestionActive() {
        let a = this.getApi()
        return a.isQuestionActive()
    }
    /**
     * We are usually showing the 'question' or 'general' content. But when the
     * question ends we can show 'answer' content which displays information to the user
     * about what the answer actually is. This method determines if we should be showing the
     * answer content
     * @returns {boolean} True if we should be showing the answer content
     */
    isShowAnswer() {
        if (this.flags.updateAnswerHasRun) {return false;}
        let gs = this.getGameState();
        if (!gs || !gs.isShowAnswer) {return false;}
        if (!this.isPlayableComponent || this.isPlayableComponent === false) {return false;}
        if (!this.getApi().isHost()) {return false;}
        return true
    }
    /**
     * Returns the current countdown time
     * which is the time remaining to answer the question
     * @returns {number} the current time remaining in seconds
     */
    getTimeLeft() {
        let a = this.getApi();
        return a.getTimeLeft();
    }
    /**
     * Returns the user object
     * @returns {object} the current player object
     */
    getCurrentPlayer() {return this.getApi().getCurrentPlayer();}
    /**
     * Concenience method for getting the current players map
     * @returns {Players} the current players map
     */
    getPlayers() {return this.getApi().getPlayers();}
    /**
     * By default will return true if the current question is
     * counting down. False otherwise.
     * May be overriden to provide different hueristics.
     * Used almost exclusively by AnimatedButton objects which extend this
     * class but has been placed here in case other page elements need it
     * @returns {boolean} true if this page element is enabled
     */
    isEnabled() {
        let ret = this.isQuestionActive();
        return ret;
    }

    /**
     * returns true if the dom element that this object manages should be
     * updated (drawn or redrawn)
     * @returns {boolean} true if this object should update the dom element it manages
     */
    doShouldUpdate() {
        // do some sanity checks
        if (!this.doShouldShow()) {return false;}
        // Allow extending class to force update
        if (this.shouldUpdate()) {return true;}
        // If the content hasn't already been shown..
        if (!this.flags.updateHasRun) {return true;}
        // If we should be showing the answer content..
        if (this.isShowAnswer()) {return true;}
        // ok no good reason to update
        return false;
    }
    /**
     *
     * Method intended to be overriden by the extending class
     * Allows the extending class to add logic determining whether
     * the dom element managed by this object should be updated (should re-draw)
     * defaults to false since the wrapper method doShouldUpdate contains
     * logic sufficient for most purposes such as initial rendering etc.
     * @returns {boolean} default true
     */
    shouldUpdate() {return false;}
    /**
     * Called by the GameAPI on each poll, if appropriate
     * Buffers the update of the dom element managed by this object
     * Calls getContent to get the new content of the dom element
     * then calls applyUpdate to actually update the main dom element
     * TODO formalise page element states
     * @param {GameAPI} gameState the current GameAPI
     * @returns {void}
     */
    update(api) {
        let cn = this.constructor.name
        this.doInitialise(api);
        if (!this.doShouldUpdate()) {return;}
        // TODO determine if we should be showing question or answer content
        this.getStyles();

        let o = null;
        if (this.isShowAnswer()) {
            // get the answer content
            o = this.getAnswerContent(api)
            // alter the flags
            this.flags.updateAnswerHasRun = true;
        } else {
            // get the general content
            o = this.getContent(api)
            // alter the flags
            this.flags.updateHasRun = true;
        }
        this.applyUpdate(o);
    }

    /**
     * Uses animation frame to replace the content of the managed
     * element without flickering etc.
     * @param {Document.Object} content a page element or elements
     * @returns {void}
     */
    applyUpdate(content) {
        let cn = this.constructor.name;
        if (!content) {return;}
        const element = this.getElement();
        if (!element) return;
        requestAnimationFrame(() => {
            if (Array.isArray(content) || content instanceof NodeList) {
                element.replaceChildren(...content);
            } else if (content instanceof Node) {
                element.replaceChildren(content);
            } else if (content) {
                this.warn('Invalid content type:', content);
            }
        });
    }
    /**
     * Should be overriden by the extending class to return
     * new dom elements which should replace the existing dom elements
     * inside the main dom element managed by this object
     * Can be ignored if applyUpdate is overriden and performs page manipulation
     * directly
     * @param {GameAPI} api the current GameAPI
     * @returns {Document.Object} a dom object or objects to be placed into the managed page element
     */
    getContent(api) {}

    /**
     * When the host clicks the 'show answer' button each PageElement should
     * Reveal some information which demonstrates the answer this content will
     * replace the current content of the pageelement.
     * By default this method is implemented to show just some basic content from
     * the currentQuestion object such as 'hostAnswer' etc. but this method
     * can be overriden to show more detailed answers
     * @param {GameAPI} api
     * @returns {Document.Object}
     */
    getAnswerContent(api) {
        let cq = this.getCurrentQuestion();
        const container = document.createElement('div');
        container.textContent = 'Some Answer or other';
        // populate div with cq.link if it exists
        // and also cq.hostAnswer if it exists
        return container
    }

    /**
     * Calls createStyles to create any css styles required
     * buy the dom object managed by this object.
     * Once createStyles has run, the response is cached locally
     * so that the dom doesn't get repeatedly searched.
     * If you wish to do something dynamic with styles you can
     * set this.styles=null and createStyles will be re-called
     * Can be overriden by extending classes to do some other sort
     * of CSS manipulation (differently named css classes etc.)
     * @returns {void}
     */
    getStyles() {
        if (this.styles) {return;}
        const existingStyle = document.getElementById(this.styleId);
        if (existingStyle) {
            this.styles = existingStyle;
            return;
        }
        const se = document.createElement('style');
        // name the style so that we don't re-apply it
        se.id = this.styleId;

        let css = this.createStyles();

        if (!css) {
            this.styles = 'nostyles';
            return;
        }
        se.innerHTML = css;
        this.styles = se;
        document.head.appendChild(se);
    }
    /**
     * should be overriden to return the CSS markup required by this dom element
     * If no particular styles are required just don't implement the method or
     * return null from your implementation
     * If you're using CSS in the main.css stylesheet then don't impleent this method
     * instead implement getStyles as:
     * - getStyles() {}
     * This will save a little time
     * @returns {string} containing CSS markup
     */
    createStyles() {return null;}
    /**
     * checks fields in the question to determine if this page element
     * is relevant. For example if this is not a multichoice question then
     * then any page element dealing with multichoice questions is not appropriate
     * @param {*} q
     * @returns {boolean} true this page element is appropriate for the given question
     */
    isCompatibleWithQuestion(cq) {
        if (!cq || !cq.type) {
            this.warn("no question.. can't continue")
            this.hide();
            return false;
        }
        let t = cq.type
        if (!t) {
            this.warn("question doesn't have a type");
            this.hide()
            return false;
        }
        let qt = this.questionTypes
        if (!qt || !Array.isArray(qt)) {
            this.warn("no question types")
            this.hide()
            return false;
        }
        // Check if this PageElement supports the current game type
        // this is non-negotiable
        if (!qt.includes("*")) {
            if (!qt.includes(cq.type)) {
                this.hide();
                return false;
            }
        }
        //console.log(`${qt} is compatible with ${cq.type}`)
        return true
    }

    /**
     * Both determines and actual actions whether this page element should be shown or not.
     * In some situations the htmt page may already contain the DIV or other element managed by this
     * object, but there may be cause for it to be hidden etc. This method asserts whether
     * the element is shown or otherwise
     * @returns {boolean} true if the managed element should be shown
     */
    doShouldShow() {
        if (!this.getElement()) {return false;}
        let cq = this.getCurrentQuestion();
        if (!this.isCompatibleWithQuestion(cq)) {return false;}
        // let the extending class have the final say
        let ss = this.shouldShow();
        if (ss) {
            this.show();
            return true;
        } else {
            this.hide();
            return false;
        }
    }

    /**
    * returns true if the question has been answered or if the answer
    * has been recently submitted
    * @returns {boolean} true if the current question has been answered
    */
    hasAnswered() {
        if (this.selectedAnswer && this.answerSubmitted) {return true;}
        const g = this.getApi();
        if (g.hasAnswered()) {
            this.answerSubmitted = true;
            return true;
        }
        this.answerSubmitted = false;
        return false;
    }

    /**
     * Gets the array of answers that have been submitted (if any) for
     * this question
     * @returns {array{answer}}
     */
    getAnswers() {
        let cq = this.getCurrentQuestion();
        if (!cq) {return null;}
        let answers = cq.answers;
        if (!answers) {return null;}
        return answers;
    }

    /**
     * Returns any answer the player has already submitted for this
     * question
     * @returns {answer} an answer if the player has submitted one
     */
    getPlayerAnswer() {
        let ans = this.getAnswers();
        if (!ans || ans.length === 0) {return null;}
        let p = this.getCurrentPlayer();
        if (!p) {return null;}
        let a = ans.find(a => a.username === p.username);
        return a;
    }

    /**
     * Generally the answer will be placed into this.selectedAnswer by some user
     * interaction such as a button click etc.
     * However when the GameAPI asks for the answer we may wish to add some global
     * logic to the answer before returning. For example we may apply a penalty for answering the
     * question too slowly etc.
     * @returns {Answer} The Answer object (for this user) with the points and everything else already calculated
     */
    doGetAnswer() {
        if (this.selectedAnswer) {return this.selectedAnswer;}
        this.selectedAnswer = this.getAnswer();
        if (!this.selectedAnswer) {return null;}
        this.answerSubmitted = true;
        if (this.selectedAnswer.points && this.selectedAnswer.points > 0) {
            let cq = this.getCurrentQuestion();
            // only apply the penalty to 5% of the available points
            let pa = 0.05 * cq.pointsAvailable;
            let tl = this.getTimeLeft();
            if (!tl || tl <= 0) {return 1;}
            let ptu = 1.0 - (tl / cq.timeLimit);
            let penalty = ptu * pa;
            let originalPoints = this.selectedAnswer.points;
            let penalizedPoints = originalPoints - penalty;
            // Apply the penalty
            this.selectedAnswer.points = penalizedPoints;
        }
        return this.selectedAnswer;
    }

    /**
     * Should be overriden to return the answer to the current question
     * as submitted by the user
     * @returns {Answer}
     */
    getAnswer() {return null;}
    /**
     * Should be overriden to determine if this dom element should
     * be hidden or shown based on some logic. Default true
     * @returns {boolean} true if the dom element should be visible
     */
    shouldShow() {return true;}

    /**
     * sets the managed page elements style visibility and
     * display parameters such that the element is shown
     * @returns {void}
     */
    show() {
        let el = this.getElement();
        if (!el) {
            this.warn(`Element ${this.name} not found in DOM`);
            return;
        }
        el.style.visibility = 'visible';
        el.style.display = 'block';
    }

    /**
     * sets the managed page elements style visibility and
     * display parameters such that the element is hidden
     * @returns {void}
     */
    hide() {
        let el = this.getElement();
        if (!el) {
            this.warn(`Element ${this.name} not found in DOM`);
            return;
        }
        el.style.visibility = 'hidden';
        el.style.display = 'none';
    }
}