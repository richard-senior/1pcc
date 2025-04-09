/**
 * An object representing the state of a PageElement
 */
class State {

    static states = [
        "CONSTRUCTING", "AWAITING_INIT", "INITIALISING",
        "PLAYING",
        "GETTING_ANSWER_CONTENT"
      ];

    constructor(state) {
        if (!State.states.includes(state)) {
            throw new Error(`Invalid state: ${state}`);
        }
        this.state = state;
    }

    toString() {
      return `State.${this.state}`;
    }
  }