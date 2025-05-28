// Essentially starts the clientside polling when the dom content is all loaded
// Appended to the bottom of main.js when functions.sh#combineJsFiles() concatenates the js files
document.addEventListener('DOMContentLoaded', () => {
    // start the game API singleton if it hasn't already been started
    // This will also start polling the server for game state updates
    const gameApi = GameAPI.getInstance();
});