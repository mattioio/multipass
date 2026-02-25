import { randomBytes, randomUUID } from "crypto";
import { ERROR_CODES } from "../../protocol/errors.js";

const AVATARS = Object.freeze({
  yellow: { id: "yellow", name: "Yellow", theme: "yellow" },
  red: { id: "red", name: "Red", theme: "red" },
  green: { id: "green", name: "Green", theme: "green" },
  blue: { id: "blue", name: "Blue", theme: "blue" }
});

const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DEFAULT_ROOM_TTL_MS = 90 * 60 * 1000;

function now() {
  return Date.now();
}

function fail(errorCode, errorMessage = null) {
  return {
    ok: false,
    errorCode,
    errorMessage
  };
}

export function createRoomService({ store, gameService, roomTtlMs = DEFAULT_ROOM_TTL_MS }) {
  if (!store) throw new Error("room store is required");
  if (!gameService) throw new Error("game service is required");

  function generateId(prefix = "id") {
    return `${prefix}_${randomUUID().replace(/-/g, "")}`;
  }

  function generateClientId() {
    return generateId("client");
  }

  function generateRoomCode() {
    const bytes = randomBytes(ROOM_CODE_LENGTH);
    let code = "";
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      const value = bytes[index] % ROOM_CODE_CHARS.length;
      code += ROOM_CODE_CHARS[value];
    }
    return code;
  }

  function uniqueRoomCode() {
    let code = generateRoomCode();
    while (store.hasRoom(code)) {
      code = generateRoomCode();
    }
    return code;
  }

  function normalizeRoomCode(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase();
  }

  function getAvatarId(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase();
  }

  function normalizeHonorific(raw) {
    return String(raw || "").trim().toLowerCase() === "mrs" ? "mrs" : "mr";
  }

  function formatDisplayName(baseName, honorific) {
    const prefix = honorific === "mrs" ? "Mrs" : "Mr";
    return `${prefix} ${baseName}`;
  }

  function getAvatar(avatarId) {
    return AVATARS[avatarId] || null;
  }

  function hasAvatar(avatarId) {
    return Boolean(getAvatar(avatarId));
  }

  function isAvatarTaken(room, avatarId) {
    const avatar = getAvatar(avatarId);
    if (!avatar || !room) return false;
    const takenThemes = [room.players.host?.theme, room.players.guest?.theme].filter(Boolean);
    return takenThemes.includes(avatar.theme);
  }

  function buildPlayer({ name, honorific, role, clientId, theme }) {
    return {
      id: generateId("player"),
      name,
      honorific,
      theme,
      role,
      score: 0,
      gamesWon: 0,
      ready: false,
      token: clientId,
      seatToken: generateId("seat"),
      connected: true
    };
  }

  function publicPlayer(player) {
    if (!player) return null;
    return {
      id: player.id,
      name: player.name,
      honorific: player.honorific || "mr",
      theme: player.theme,
      role: player.role,
      score: player.score,
      gamesWon: player.gamesWon ?? 0,
      ready: Boolean(player.ready),
      connected: player.connected
    };
  }

  function projectGameForViewer(gameInstance, viewerPlayerId = null) {
    if (!gameInstance) return null;
    const gameConfig = gameService.getGame(gameInstance.id);
    if (typeof gameConfig?.projectState !== "function") {
      return gameInstance;
    }

    let projectedState = gameInstance.state;
    try {
      projectedState = gameConfig.projectState(gameInstance.state, viewerPlayerId);
    } catch {
      projectedState = gameInstance.state;
    }

    return {
      ...gameInstance,
      state: projectedState
    };
  }

  function publicRoom(room, options = {}) {
    const viewerPlayerId = options.viewerPlayerId || null;
    return {
      code: room.code,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      players: {
        host: publicPlayer(room.players.host),
        guest: publicPlayer(room.players.guest)
      },
      spectators: room.spectators.map((spectator) => publicPlayer(spectator)),
      round: room.round
        ? {
            pickerId: room.round.pickerId,
            firstPlayerId: room.round.firstPlayerId,
            shuffleAt: room.round.shuffleAt,
            status: room.round.status,
            hostGameId: room.round.hostGameId ?? null,
            guestGameId: room.round.guestGameId ?? null,
            resolvedGameId: room.round.resolvedGameId ?? null,
            hasPickedStarter: Boolean(room.round.hasPickedStarter)
          }
        : null,
      endRequest: room.endRequest,
      game: projectGameForViewer(room.game, viewerPlayerId),
      games: gameService.listPublicGames()
    };
  }

  function publicRoomPreview(room) {
    return {
      code: room.code,
      host: publicPlayer(room.players.host),
      guest: publicPlayer(room.players.guest),
      takenThemes: [room.players.host?.theme, room.players.guest?.theme].filter(Boolean)
    };
  }

  function roomPreview(room, options = {}) {
    return {
      ...publicRoomPreview(room),
      canRejoin: Boolean(options.canRejoin)
    };
  }

  function createRoom({ avatarId, clientId, honorific = "mr" }) {
    const avatar = getAvatar(avatarId);
    if (!avatar) return null;

    const normalizedHonorific = normalizeHonorific(honorific);
    const host = buildPlayer({
      name: formatDisplayName(avatar.name, normalizedHonorific),
      honorific: normalizedHonorific,
      role: "host",
      clientId,
      theme: avatar.theme
    });

    const room = {
      code: uniqueRoomCode(),
      createdAt: now(),
      updatedAt: now(),
      players: {
        host,
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
      game: null
    };

    store.setRoom(room.code, room);
    return room;
  }

  function getRoom(code) {
    return store.getRoom(normalizeRoomCode(code));
  }

  function getRoomPlayers(room) {
    const players = [];
    if (room.players.host) players.push(room.players.host);
    if (room.players.guest) players.push(room.players.guest);
    return players;
  }

  function findPlayerByToken(room, token) {
    if (!token) return null;
    return getRoomPlayers(room).find((entry) => entry.token === token) || null;
  }

  function findSeatPlayerBySeatToken(room, seatToken) {
    if (!seatToken) return null;
    return getRoomPlayers(room).find((entry) => entry.seatToken === seatToken) || null;
  }

  function findRejoinPlayer(room, { seatToken, clientId }) {
    return findSeatPlayerBySeatToken(room, seatToken) || findPlayerByToken(room, clientId);
  }

  function touchRoom(room) {
    room.updatedAt = now();
  }

  function resetRound(room, options = {}) {
    const { resetStarter = false } = options;
    const previous = room.round || {};
    room.round = {
      pickerId: resetStarter ? null : (previous.pickerId ?? null),
      firstPlayerId: resetStarter ? null : (previous.firstPlayerId ?? null),
      shuffleAt: null,
      status: "waiting_game",
      hostGameId: null,
      guestGameId: null,
      resolvedGameId: null,
      hasPickedStarter: resetStarter ? false : Boolean(previous.hasPickedStarter)
    };
  }

  function addGuestToRoom(room, { avatarId, honorific, clientId }) {
    const avatar = getAvatar(avatarId);
    if (!avatar) return fail(ERROR_CODES.AVATAR_REQUIRED);
    if (room.players.guest) return fail(ERROR_CODES.ROOM_FULL);
    if (isAvatarTaken(room, avatarId)) return fail(ERROR_CODES.AVATAR_TAKEN);

    room.players.guest = buildPlayer({
      name: formatDisplayName(avatar.name, normalizeHonorific(honorific)),
      honorific: normalizeHonorific(honorific),
      role: "guest",
      clientId,
      theme: avatar.theme
    });
    resetRound(room, { resetStarter: true });
    room.game = null;
    room.endRequest = null;

    return {
      ok: true,
      room,
      player: room.players.guest,
      role: "guest"
    };
  }

  function orderPlayers(players, firstPlayerId) {
    if (!firstPlayerId) return players;
    const first = players.find((player) => player.id === firstPlayerId);
    if (!first) return players;
    return [first, ...players.filter((player) => player.id !== firstPlayerId)];
  }

  function canStartGame(room, gameId, firstPlayerId) {
    const game = gameService.getGame(gameId);
    if (!game) return fail(ERROR_CODES.UNKNOWN_GAME);
    if (game.comingSoon) return fail(ERROR_CODES.GAME_COMING_SOON);

    const players = getRoomPlayers(room);
    if (players.length < game.minPlayers) return fail(ERROR_CODES.WAITING_FOR_SECOND_PLAYER, "Not enough players to start.");
    if (players.length > game.maxPlayers) return fail(ERROR_CODES.WAITING_FOR_SECOND_PLAYER, "Too many players to start.");

    return {
      ok: true,
      game,
      players: orderPlayers(players, firstPlayerId)
    };
  }

  function setPlayerGameChoice(room, role, gameId) {
    if (role === "host") {
      room.round.hostGameId = gameId;
      return;
    }
    if (role === "guest") {
      room.round.guestGameId = gameId;
    }
  }

  function resolveGameChoice(room) {
    const hostChoice = room.round.hostGameId;
    const guestChoice = room.round.guestGameId;
    if (!hostChoice || !guestChoice) {
      room.round.resolvedGameId = null;
      return null;
    }
    room.round.resolvedGameId = hostChoice;
    return room.round.resolvedGameId;
  }

  function getOtherPlayerId(room, playerId) {
    const next = getRoomPlayers(room).find((player) => player.id !== playerId);
    return next ? next.id : null;
  }

  function resolveFirstPlayerId(room) {
    const players = getRoomPlayers(room);
    if (players.length < 2) return null;
    const hostId = room.players.host?.id || players[0]?.id || null;
    if (!room.round.firstPlayerId) return hostId;
    return getOtherPlayerId(room, room.round.firstPlayerId) || hostId;
  }

  function startRoundFromResolvedGame(room) {
    const resolvedGameId = room.round?.resolvedGameId;
    if (!resolvedGameId) {
      return fail(ERROR_CODES.UNKNOWN_GAME, "Waiting for both players to choose a game.");
    }

    const firstPlayerId = resolveFirstPlayerId(room);
    if (!firstPlayerId) return fail(ERROR_CODES.WAITING_FOR_SECOND_PLAYER, "Not enough players to start.");

    const startable = canStartGame(room, resolvedGameId, firstPlayerId);
    if (!startable.ok) return startable;

    room.game = {
      id: startable.game.id,
      state: startable.game.init(startable.players)
    };
    room.endRequest = null;
    room.round.firstPlayerId = firstPlayerId;
    room.round.pickerId = firstPlayerId;
    room.round.hasPickedStarter = true;
    room.round.status = "playing";
    room.round.shuffleAt = null;

    return { ok: true };
  }

  function selectGame(room, role, gameId) {
    const game = gameService.getGame(gameId);
    if (!gameId || !game) return fail(ERROR_CODES.UNKNOWN_GAME);
    if (game.comingSoon) return fail(ERROR_CODES.GAME_COMING_SOON);

    if (!room.players.host || !room.players.guest) {
      return fail(ERROR_CODES.WAITING_FOR_SECOND_PLAYER);
    }

    if (room.game && !room.game.state?.winnerId && !room.game.state?.draw) {
      return fail(ERROR_CODES.FINISH_CURRENT_GAME);
    }

    if (!room.round) {
      resetRound(room, { resetStarter: true });
    }

    setPlayerGameChoice(room, role, gameId);
    room.round.status = "waiting_game";
    const resolvedGameId = resolveGameChoice(room);
    if (!resolvedGameId) {
      touchRoom(room);
      return { ok: true, waitingForPeerChoice: true };
    }

    const started = startRoundFromResolvedGame(room);
    if (!started.ok) return started;

    touchRoom(room);
    return { ok: true };
  }

  function startNewRound(room) {
    if (room.game && !room.game.state?.winnerId && !room.game.state?.draw) {
      return fail(ERROR_CODES.FINISH_CURRENT_GAME);
    }
    room.game = null;
    room.endRequest = null;
    resetRound(room, { resetStarter: false });
    touchRoom(room);
    return { ok: true };
  }

  function requestEndGame(room, playerId) {
    if (!room.game || room.game.state?.winnerId || room.game.state?.draw) {
      return fail(ERROR_CODES.NO_ACTIVE_GAME);
    }
    room.endRequest = { byId: playerId, at: now() };
    touchRoom(room);
    return { ok: true };
  }

  function agreeEndGame(room, playerId) {
    if (!room.endRequest) return fail(ERROR_CODES.NO_END_GAME_REQUEST);
    if (room.endRequest.byId === playerId) return fail(ERROR_CODES.WAITING_FOR_OTHER_PLAYER);

    room.game = null;
    room.endRequest = null;
    resetRound(room, { resetStarter: false });
    touchRoom(room);
    return { ok: true };
  }

  function applyMove(room, move, playerId) {
    if (!room.game) return fail(ERROR_CODES.NO_GAME_SELECTED);

    const game = gameService.getGame(room.game.id);
    if (!game) return fail(ERROR_CODES.UNKNOWN_GAME);

    const result = game.applyMove(room.game.state, move, playerId);
    if (result?.error) {
      return fail(ERROR_CODES.INVALID_PAYLOAD, result.error);
    }

    room.game.state = result.state;

    if (room.game.state.winnerId) {
      const winner = getRoomPlayers(room).find((player) => player.id === room.game.state.winnerId);
      if (winner) {
        winner.score += 1;
        winner.gamesWon += 1;
      }
    }
    if (room.game.state.winnerId || room.game.state.draw) {
      room.endRequest = null;
    }

    touchRoom(room);
    return { ok: true };
  }

  function markPlayerDisconnected(room, playerId) {
    if (!room || !playerId) return;
    const all = [...getRoomPlayers(room), ...room.spectators];
    const player = all.find((entry) => entry.id === playerId);
    if (!player) return;
    player.connected = false;
  }

  function pruneExpiredRooms() {
    const cutoff = now() - roomTtlMs;
    for (const [code, room] of store.entries()) {
      if (room.updatedAt < cutoff) {
        store.deleteRoom(code);
      }
    }
  }

  function isReady() {
    return gameService.listPublicGames().length > 0;
  }

  return {
    AVATARS,
    now,
    generateClientId,
    getAvatar,
    hasAvatar,
    getAvatarId,
    normalizeHonorific,
    normalizeRoomCode,
    isAvatarTaken,
    publicRoom,
    publicRoomPreview,
    roomPreview,
    createRoom,
    getRoom,
    getRoomPlayers,
    findRejoinPlayer,
    addGuestToRoom,
    touchRoom,
    selectGame,
    startNewRound,
    requestEndGame,
    agreeEndGame,
    applyMove,
    markPlayerDisconnected,
    pruneExpiredRooms,
    isReady
  };
}
