document.addEventListener('DOMContentLoaded', () => {
    // start the game API singleton if it hasn't already been started
    // This will also start polling the server for game state updates
    const gameApi = GameAPI.getInstance();
});