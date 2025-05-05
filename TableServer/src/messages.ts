const errorMessages: { [key: string]: string } = {
    timeoutError: "Timeout Error.",
    PlayerError: "Player not found.",
    addPlayerError: "Player already exists.",
    TournamentError: "Tournament not found.",
    EmptyData: "Data can't be empty.",
    cashgameError: "This is not a cash game.",
    TurnTimeError: "Turn timer expired. Player folds and sits out.",
    AddChips: "New balance will be visible at the end of the round.",
    closeTable: "Table is closed.",
    RejoinGame: "You recently logged out; joining is temporarily disabled. Please try again later.",
    userRegister: "User registered as a player.",
    reconnect: "Server error. Reconnecting shortly.",
    errorReport: "Cannot continue.",
    serverReconnectError: "Internal error. We are investigating.",
    closeTournament: "Tournament is closed.",
    anotherBrowserConnection: "Connection from another browser detected.",
    tipsError: "Tip was not sent to dealer.",
    hideSidegame: "Side game disabled.",
    timeout: "Timeout occurred. Please check your internet connection.",
    wronghashError: "Incorrect hash sent. This incident will be reported.",
    insufficientBalance: "Insufficient table balance.",
    sitoutMessage: "Player is neither waiting nor playing. Sit-out request discarded.",
    sitinMesage: "Player is not sitting out. Sit-in request discarded.",
    turnTimerError: "Turn timer expired. Player folds and 'Fold Any Bet' is set.",
    hashVerifyError: "Hash mismatch detected. Potential cheating incident.",
    hashVerifySuccess: "All user hashes successfully verified by the server.",
    serverHashSuccessfull: "Successfully verified the JSON string from server.",
};

export function getErrorMessage(key: string): string {
    return errorMessages[key] || "Unknown error occurred.";
}