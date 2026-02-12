/**
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} name
 * @property {string} [emoji]
 * @property {string} [theme]
 * @property {"host"|"guest"|"local"} [role]
 * @property {number} [score]
 * @property {number} [gamesWon]
 * @property {boolean} [ready]
 * @property {boolean} [connected]
 */

/**
 * @typedef {Object} RoundState
 * @property {string|null} pickerId
 * @property {string|null} firstPlayerId
 * @property {number|null} shuffleAt
 * @property {"waiting"|"waiting_game"|"shuffling"|"ready_to_pick"|"playing"|string} status
 * @property {string|null} [hostGameId]
 * @property {string|null} [guestGameId]
 * @property {string|null} [resolvedGameId]
 * @property {boolean} [hasPickedStarter]
 */

/**
 * @typedef {Object} RoomState
 * @property {string} code
 * @property {{host: PlayerState|null, guest: PlayerState|null}} players
 * @property {RoundState|null} round
 * @property {{id: string, state: Object}|null} game
 * @property {Array<Object>} [games]
 * @property {number} [createdAt]
 * @property {number} [updatedAt]
 */

/**
 * @typedef {Object} YouState
 * @property {string} clientId
 * @property {string|null} playerId
 * @property {"host"|"guest"|"spectator"|"local"|null} role
 * @property {string|null} roomCode
 */

const REQUIRED_ROOM_KEYS = ["code", "players", "round", "game"];
const REQUIRED_PLAYERS_KEYS = ["host", "guest"];

function isObject(value) {
  return typeof value === "object" && value !== null;
}

/**
 * Validates a room payload shape in dev without throwing.
 * @param {unknown} room
 * @returns {boolean}
 */
export function assertRoomShape(room) {
  const devHost = typeof window !== "undefined"
    && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (!isObject(room)) {
    if (devHost) console.warn("[room_state] Invalid room payload: expected object.", room);
    return false;
  }

  const missing = REQUIRED_ROOM_KEYS.filter((key) => !(key in room));
  if (missing.length) {
    if (devHost) console.warn(`[room_state] Missing required room keys: ${missing.join(", ")}`, room);
    return false;
  }

  const players = /** @type {Record<string, unknown>} */ (room).players;
  if (!isObject(players)) {
    if (devHost) console.warn("[room_state] Invalid players payload.", room);
    return false;
  }

  const missingPlayers = REQUIRED_PLAYERS_KEYS.filter((key) => !(key in players));
  if (missingPlayers.length) {
    if (devHost) console.warn(`[room_state] Missing player slots: ${missingPlayers.join(", ")}`, room);
    return false;
  }

  return true;
}
