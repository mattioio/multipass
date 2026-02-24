export const ERROR_CODES = Object.freeze({
  INVALID_JSON: "INVALID_JSON",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  UNKNOWN_MESSAGE_TYPE: "UNKNOWN_MESSAGE_TYPE",
  MESSAGE_TOO_LARGE: "MESSAGE_TOO_LARGE",
  ORIGIN_NOT_ALLOWED: "ORIGIN_NOT_ALLOWED",
  RATE_LIMITED: "RATE_LIMITED",
  AVATAR_REQUIRED: "AVATAR_REQUIRED",
  ROOM_CREATE_FAILED: "ROOM_CREATE_FAILED",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  AVATAR_TAKEN: "AVATAR_TAKEN",
  JOIN_REQUIRED: "JOIN_REQUIRED",
  SPECTATOR_CANNOT_CHOOSE_GAME: "SPECTATOR_CANNOT_CHOOSE_GAME",
  WAITING_FOR_SECOND_PLAYER: "WAITING_FOR_SECOND_PLAYER",
  UNKNOWN_GAME: "UNKNOWN_GAME",
  GAME_COMING_SOON: "GAME_COMING_SOON",
  FINISH_CURRENT_GAME: "FINISH_CURRENT_GAME",
  SPECTATOR_CANNOT_NEW_ROUND: "SPECTATOR_CANNOT_NEW_ROUND",
  SPECTATOR_CANNOT_END_GAME: "SPECTATOR_CANNOT_END_GAME",
  NO_ACTIVE_GAME: "NO_ACTIVE_GAME",
  NO_END_GAME_REQUEST: "NO_END_GAME_REQUEST",
  WAITING_FOR_OTHER_PLAYER: "WAITING_FOR_OTHER_PLAYER",
  NO_GAME_SELECTED: "NO_GAME_SELECTED",
  SPECTATOR_CANNOT_PLAY: "SPECTATOR_CANNOT_PLAY",
  DEPRECATED_READY_UP: "DEPRECATED_READY_UP",
  DEPRECATED_START_ROUND: "DEPRECATED_START_ROUND"
});

const DEFAULT_MESSAGES = Object.freeze({
  [ERROR_CODES.INVALID_JSON]: "Invalid JSON.",
  [ERROR_CODES.INVALID_PAYLOAD]: "Invalid message payload.",
  [ERROR_CODES.UNKNOWN_MESSAGE_TYPE]: "Unknown message type.",
  [ERROR_CODES.MESSAGE_TOO_LARGE]: "Message payload too large.",
  [ERROR_CODES.ORIGIN_NOT_ALLOWED]: "Origin not allowed.",
  [ERROR_CODES.RATE_LIMITED]: "Too many requests. Try again in a moment.",
  [ERROR_CODES.AVATAR_REQUIRED]: "Pick an avatar.",
  [ERROR_CODES.ROOM_CREATE_FAILED]: "Unable to create room.",
  [ERROR_CODES.ROOM_NOT_FOUND]: "Room not found.",
  [ERROR_CODES.ROOM_FULL]: "Room is full.",
  [ERROR_CODES.AVATAR_TAKEN]: "That avatar is already taken.",
  [ERROR_CODES.JOIN_REQUIRED]: "Join a room first.",
  [ERROR_CODES.SPECTATOR_CANNOT_CHOOSE_GAME]: "Spectators cannot choose a game.",
  [ERROR_CODES.WAITING_FOR_SECOND_PLAYER]: "Waiting for a second player.",
  [ERROR_CODES.UNKNOWN_GAME]: "Unknown game.",
  [ERROR_CODES.GAME_COMING_SOON]: "That game is coming soon.",
  [ERROR_CODES.FINISH_CURRENT_GAME]: "Finish the current game first.",
  [ERROR_CODES.SPECTATOR_CANNOT_NEW_ROUND]: "Spectators cannot start a new round.",
  [ERROR_CODES.SPECTATOR_CANNOT_END_GAME]: "Spectators cannot end a game.",
  [ERROR_CODES.NO_ACTIVE_GAME]: "No active game to end.",
  [ERROR_CODES.NO_END_GAME_REQUEST]: "No end game request to approve.",
  [ERROR_CODES.WAITING_FOR_OTHER_PLAYER]: "Waiting for the other player.",
  [ERROR_CODES.NO_GAME_SELECTED]: "No game selected.",
  [ERROR_CODES.SPECTATOR_CANNOT_PLAY]: "Spectators cannot play.",
  [ERROR_CODES.DEPRECATED_READY_UP]: "Ready up is no longer required. Pick a game.",
  [ERROR_CODES.DEPRECATED_START_ROUND]: "Start round is no longer required. Pick a game."
});

export function createErrorPayload(code, overrideMessage = null) {
  const message = overrideMessage || DEFAULT_MESSAGES[code] || "Something went wrong.";
  return {
    type: "error",
    code,
    message
  };
}

export function getDefaultErrorMessage(code) {
  return DEFAULT_MESSAGES[code] || "Something went wrong.";
}
