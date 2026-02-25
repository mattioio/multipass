import { ERROR_CODES } from "./errors.js";

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeMessageType(rawType) {
  return String(rawType || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export const KNOWN_CLIENT_MESSAGE_TYPES = Object.freeze(new Set([
  "create_room",
  "join_room",
  "validate_room",
  "leave_room",
  "ready_up",
  "start_round",
  "select_game",
  "new_round",
  "end_game_request",
  "end_game_agree",
  "move"
]));

export const HIGH_RISK_ACTIONS = Object.freeze(new Set([
  "create_room",
  "join_room",
  "validate_room",
  "move"
]));

export function parseInboundMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    return { ok: false, errorCode: ERROR_CODES.INVALID_JSON };
  }

  if (!isObject(parsed)) {
    return { ok: false, errorCode: ERROR_CODES.INVALID_PAYLOAD };
  }

  if (typeof parsed.type !== "string" || !parsed.type.trim()) {
    return { ok: false, errorCode: ERROR_CODES.INVALID_PAYLOAD };
  }

  return {
    ok: true,
    message: parsed,
    type: normalizeMessageType(parsed.type),
    knownType: KNOWN_CLIENT_MESSAGE_TYPES.has(normalizeMessageType(parsed.type))
  };
}

export function validateServerPayload(payload) {
  if (!isObject(payload) || typeof payload.type !== "string") return false;
  if (payload.type === "error") {
    return typeof payload.message === "string"
      && (typeof payload.code === "string" || typeof payload.code === "undefined");
  }
  if (payload.type === "session") {
    return typeof payload.clientId === "string";
  }
  if (payload.type === "room_state") {
    return isObject(payload.room) && isObject(payload.you);
  }
  if (payload.type === "room_preview") {
    return isObject(payload.room);
  }
  return true;
}

export const CONTRACT_EXAMPLES = Object.freeze({
  serverToClient: {
    session: {
      type: "session",
      clientId: "client_xxx",
      seatToken: "seat_xxx"
    },
    room_state: {
      type: "room_state",
      room: {
        code: "ABCD",
        createdAt: 1730000000000,
        updatedAt: 1730000000100,
        players: {
          host: {
            id: "player_x",
            name: "Mr Yellow",
            honorific: "mr",
            theme: "yellow",
            role: "host",
            score: 0,
            gamesWon: 0,
            ready: false,
            connected: true
          },
          guest: null
        },
        spectators: [],
        round: {
          pickerId: null,
          firstPlayerId: null,
          shuffleAt: null,
          status: "waiting_game",
          hostGameId: null,
          guestGameId: null,
          resolvedGameId: null,
          hasPickedStarter: false
        },
        endRequest: null,
        game: null,
        games: [
          {
            id: "tic_tac_toe",
            name: "Tic Tac Toe",
            minPlayers: 2,
            maxPlayers: 2,
            comingSoon: false,
            bannerKey: "tic_tac_toe"
          },
          {
            id: "dots_and_boxes",
            name: "Dots & Boxes",
            minPlayers: 2,
            maxPlayers: 2,
            comingSoon: false,
            bannerKey: "dots_and_boxes"
          },
          {
            id: "word_fight",
            name: "Word Fight",
            minPlayers: 2,
            maxPlayers: 2,
            comingSoon: false,
            bannerKey: "word_fight"
          },
          {
            id: "poker_dice",
            name: "Poker Dice",
            minPlayers: 2,
            maxPlayers: 2,
            comingSoon: false,
            bannerKey: "poker_dice"
          }
        ]
      },
      you: {
        clientId: "client_xxx",
        playerId: "player_x",
        role: "host",
        roomCode: "ABCD"
      }
    },
    room_preview: {
      type: "room_preview",
      room: {
        code: "ABCD",
        host: {
          id: "player_x",
          name: "Mr Yellow",
          honorific: "mr",
          theme: "yellow",
          role: "host",
          score: 0,
          gamesWon: 0,
          ready: false,
          connected: true
        },
        guest: null,
        takenThemes: ["yellow"],
        canRejoin: false
      }
    },
    error: {
      type: "error",
      code: "ROOM_NOT_FOUND",
      message: "Room not found."
    }
  },
  clientToServer: {
    create_room: { type: "create_room", avatar: "yellow", honorific: "mr", clientId: "optional" },
    join_room: { type: "join_room", code: "ABCD", avatar: "green", honorific: "mrs", clientId: "optional", seatToken: "optional" },
    validate_room: { type: "validate_room", code: "ABCD", clientId: "optional", seatToken: "optional" },
    leave_room: { type: "leave_room" },
    select_game: { type: "select_game", gameId: "tic_tac_toe" },
    move_tic_tac_toe: { type: "move", gameId: "tic_tac_toe", move: { index: 0 } },
    move_dots_and_boxes: { type: "move", gameId: "dots_and_boxes", move: { edgeIndex: 0 } },
    move_word_fight: { type: "move", gameId: "word_fight", move: { guess: "LAMP" } },
    move_poker_dice_roll: { type: "move", gameId: "poker_dice", move: { action: "roll", hold: [0, 2] } },
    move_poker_dice_bank: { type: "move", gameId: "poker_dice", move: { action: "bank" } },
    new_round: { type: "new_round" },
    end_game_request: { type: "end_game_request" },
    end_game_agree: { type: "end_game_agree" }
  }
});
