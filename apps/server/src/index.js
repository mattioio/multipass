import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync, statSync } from "fs";
import { WebSocketServer } from "ws";
import games, { listGames } from "./games/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../../web");

const PORT = Number(process.env.PORT) || 3000;
const ROOM_TTL_MS = 90 * 60 * 1000;
const FRUITS = {
  banana: { id: "banana", name: "Banana", emoji: "🍌", theme: "banana" },
  strawberry: { id: "strawberry", name: "Strawberry", emoji: "🍓", theme: "strawberry" },
  kiwi: { id: "kiwi", name: "Kiwi", emoji: "🥝", theme: "kiwi" },
  blueberry: { id: "blueberry", name: "Blueberry", emoji: "🫐", theme: "blueberry" }
};
const CODE_LENGTH = 4;

const rooms = new Map();
const clients = new Map();

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function now() {
  return Date.now();
}

function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

function uniqueRoomCode() {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  return code;
}

function getFruitId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function getFruit(fruitId) {
  return FRUITS[fruitId] || null;
}

function isFruitTaken(room, fruit) {
  if (!fruit) return false;
  const taken = [room.players.host?.theme, room.players.guest?.theme].filter(Boolean);
  return taken.includes(fruit.theme);
}

function buildPlayer({ name, emoji, role, clientId, theme }) {
  return {
    id: generateId("player"),
    name,
    emoji,
    theme,
    role,
    score: 0,
    gamesWon: 0,
    ready: false,
    token: clientId,
    connected: true
  };
}

function publicPlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    theme: player.theme,
    role: player.role,
    score: player.score,
    gamesWon: player.gamesWon ?? 0,
    ready: Boolean(player.ready),
    connected: player.connected
  };
}

function publicRoom(room) {
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
          status: room.round.status
        }
      : null,
    endRequest: room.endRequest,
    game: room.game,
    games: listGames()
  };
}

function send(ws, payload) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcastRoom(room) {
  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === room.code) {
      send(ws, {
        type: "room_state",
        room: publicRoom(room),
        you: {
          clientId: client.clientId,
          playerId: client.playerId,
          role: client.role,
          roomCode: client.roomCode
        }
      });
    }
  }
}

function touchRoom(room) {
  room.updatedAt = now();
}

function getRoomPlayers(room) {
  const players = [];
  if (room.players.host) players.push(room.players.host);
  if (room.players.guest) players.push(room.players.guest);
  return players;
}

function findPlayerByToken(room, token) {
  if (!token) return null;
  const all = [...getRoomPlayers(room), ...room.spectators];
  return all.find((entry) => entry.token === token) || null;
}

function attachClient(ws, room, player, role, clientId) {
  clients.set(ws, {
    clientId,
    roomCode: room.code,
    playerId: player?.id ?? null,
    role
  });
}

function createRoom({ fruitId, clientId }) {
  const code = uniqueRoomCode();
  const fruit = getFruit(fruitId);
  if (!fruit) return null;
  const host = buildPlayer({
    name: fruit.name,
    emoji: fruit.emoji,
    role: "host",
    clientId,
    theme: fruit.theme
  });
  const room = {
    code,
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
      status: "waiting"
    },
    endRequest: null,
    game: null
  };
  rooms.set(code, room);
  return room;
}

function canStartGame(room, gameId, firstPlayerId) {
  const game = games[gameId];
  if (!game) return { ok: false, error: "Unknown game." };
  const players = getRoomPlayers(room);
  if (players.length < game.minPlayers) {
    return { ok: false, error: "Not enough players to start." };
  }
  if (players.length > game.maxPlayers) {
    return { ok: false, error: "Too many players to start." };
  }
  const orderedPlayers = orderPlayers(players, firstPlayerId);
  return { ok: true, game, players: orderedPlayers };
}

function orderPlayers(players, firstPlayerId) {
  if (!firstPlayerId) return players;
  const first = players.find((player) => player.id === firstPlayerId);
  if (!first) return players;
  return [first, ...players.filter((player) => player.id !== firstPlayerId)];
}

function resetRound(room) {
  room.round = {
    pickerId: null,
    firstPlayerId: null,
    shuffleAt: null,
    status: "waiting"
  };
}

function assignRound(room) {
  const players = getRoomPlayers(room);
  if (players.length < 2) return;
  const [a, b] = players;
  const picker = Math.random() < 0.5 ? a : b;
  room.round = {
    pickerId: picker.id,
    firstPlayerId: picker.id,
    shuffleAt: now(),
    status: "shuffling"
  };
}

function markReady(room) {
  room.round = {
    pickerId: null,
    firstPlayerId: null,
    shuffleAt: null,
    status: "ready"
  };
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  }

  const filePath = path.join(webRoot, pathname);
  if (!filePath.startsWith(webRoot)) {
    res.writeHead(400);
    res.end("Bad request.");
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("Not found.");
    return;
  }

  const ext = path.extname(filePath);
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const data = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(data);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      send(ws, { type: "error", message: "Invalid JSON." });
      return;
    }

    const { type } = message;

    if (type === "create_room") {
      const fruitId = getFruitId(message.fruit);
      const clientId = message.clientId || generateId("client");
      const fruit = getFruit(fruitId);

      if (!fruit) {
        send(ws, { type: "error", message: "Pick a fruit." });
        return;
      }

      const room = createRoom({ fruitId, clientId });
      if (!room) {
        send(ws, { type: "error", message: "Unable to create room." });
        return;
      }
      attachClient(ws, room, room.players.host, "host", clientId);

      send(ws, { type: "session", clientId });
      broadcastRoom(room);
      return;
    }

    if (type === "join_room") {
      const code = String(message.code || "")
        .trim()
        .toUpperCase();
      const fruitId = getFruitId(message.fruit);
      const clientId = message.clientId || generateId("client");

      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: "error", message: "Room not found." });
        return;
      }

      const existing = findPlayerByToken(room, clientId);
      if (existing) {
        existing.connected = true;
        attachClient(ws, room, existing, existing.role, clientId);
        send(ws, { type: "session", clientId });
        touchRoom(room);
        broadcastRoom(room);
        return;
      }

      const fruit = getFruit(fruitId);
      if (!fruit) {
        send(ws, { type: "error", message: "Pick a fruit." });
        return;
      }
      if (isFruitTaken(room, fruit)) {
        send(ws, { type: "error", message: "That fruit is already taken." });
        return;
      }

      if (!room.players.guest) {
        room.players.guest = buildPlayer({
          name: fruit.name,
          emoji: fruit.emoji,
          role: "guest",
          clientId,
          theme: fruit.theme
        });
        room.players.host.ready = false;
        room.players.guest.ready = false;
        resetRound(room);
        attachClient(ws, room, room.players.guest, "guest", clientId);
        send(ws, { type: "session", clientId });
        touchRoom(room);
        broadcastRoom(room);
        return;
      }

      send(ws, { type: "error", message: "Room is full." });
      return;
    }

    const client = clients.get(ws);
    if (!client) {
      send(ws, { type: "error", message: "Join a room first." });
      return;
    }

    const room = rooms.get(client.roomCode);
    if (!room) {
      send(ws, { type: "error", message: "Room not found." });
      return;
    }

    if (type === "leave_room") {
      const all = [...getRoomPlayers(room), ...room.spectators];
      const player = all.find((entry) => entry.id === client.playerId);
      if (player) {
        player.connected = false;
        player.ready = false;
      }
      room.endRequest = null;
      if (!room.players.host?.ready || !room.players.guest?.ready) {
        resetRound(room);
      }
      touchRoom(room);
      broadcastRoom(room);
      clients.delete(ws);
      return;
    }

    if (type === "ready_up") {
      if (client.role !== "host" && client.role !== "guest") {
        send(ws, { type: "error", message: "Spectators cannot ready up." });
        return;
      }
      if (room.game && !room.game.state?.winnerId && !room.game.state?.draw) {
        send(ws, { type: "error", message: "Finish the current game first." });
        return;
      }
      const player = getRoomPlayers(room).find((entry) => entry.id === client.playerId);
      if (!player) {
        send(ws, { type: "error", message: "Player not found." });
        return;
      }
      if (typeof message.ready === "boolean") {
        player.ready = message.ready;
      } else {
        player.ready = !player.ready;
      }

      if (room.players.host?.ready && room.players.guest?.ready) {
        markReady(room);
      } else {
        resetRound(room);
      }

      touchRoom(room);
      broadcastRoom(room);
      return;
    }

    if (type === "start_round") {
      if (client.role !== "host" && client.role !== "guest") {
        send(ws, { type: "error", message: "Spectators cannot start a round." });
        return;
      }
      if (!room.players.host?.ready || !room.players.guest?.ready) {
        send(ws, { type: "error", message: "Both players must ready up first." });
        return;
      }
      if (room.round?.pickerId) {
        touchRoom(room);
        broadcastRoom(room);
        return;
      }
      assignRound(room);
      room.endRequest = null;
      touchRoom(room);
      broadcastRoom(room);
      return;
    }

    if (type === "select_game") {
      if (!room.round?.pickerId || !room.round?.firstPlayerId) {
        send(ws, { type: "error", message: "Players must ready up first." });
        return;
      }
      if (client.playerId !== room.round.pickerId) {
        send(ws, { type: "error", message: "Only the picker can start a game." });
        return;
      }

      const { ok, game, players, error } = canStartGame(room, message.gameId, room.round.firstPlayerId);
      if (!ok) {
        send(ws, { type: "error", message: error });
        return;
      }

      room.game = {
        id: game.id,
        state: game.init(players)
      };
      room.endRequest = null;
      room.round.status = "playing";
      if (room.players.host) room.players.host.ready = false;
      if (room.players.guest) room.players.guest.ready = false;

      touchRoom(room);
      broadcastRoom(room);
      return;
    }

    if (type === "new_round") {
      if (!room.game) {
        send(ws, { type: "error", message: "No game selected." });
        return;
      }
      if (!room.round?.pickerId || client.playerId !== room.round.pickerId) {
        send(ws, { type: "error", message: "Only the picker can start a new round." });
        return;
      }
      if (!room.players.host?.ready || !room.players.guest?.ready) {
        send(ws, { type: "error", message: "Both players must ready up first." });
        return;
      }

      const { ok, game, players, error } = canStartGame(room, room.game.id, room.round.firstPlayerId);
      if (!ok) {
        send(ws, { type: "error", message: error });
        return;
      }

      room.game = {
        id: game.id,
        state: game.init(players)
      };
      room.endRequest = null;
      room.round.status = "playing";
      if (room.players.host) room.players.host.ready = false;
      if (room.players.guest) room.players.guest.ready = false;

      touchRoom(room);
      broadcastRoom(room);
      return;
    }

    if (type === "end_game_request") {
      if (client.role !== "host" && client.role !== "guest") {
        send(ws, { type: "error", message: "Spectators cannot end a game." });
        return;
      }
      if (!room.game || room.game.state?.winnerId || room.game.state?.draw) {
        send(ws, { type: "error", message: "No active game to end." });
        return;
      }
      room.endRequest = { byId: client.playerId, at: now() };
      touchRoom(room);
      broadcastRoom(room);
      return;
    }

    if (type === "end_game_agree") {
      if (client.role !== "host" && client.role !== "guest") {
        send(ws, { type: "error", message: "Spectators cannot end a game." });
        return;
      }
      if (!room.endRequest) {
        send(ws, { type: "error", message: "No end game request to approve." });
        return;
      }
      if (room.endRequest.byId === client.playerId) {
        send(ws, { type: "error", message: "Waiting for the other player." });
        return;
      }
      room.game = null;
      room.endRequest = null;
      if (room.players.host) room.players.host.ready = false;
      if (room.players.guest) room.players.guest.ready = false;
      resetRound(room);
      touchRoom(room);
      broadcastRoom(room);
      return;
    }

    if (type === "move") {
      if (!room.game) {
        send(ws, { type: "error", message: "No game selected." });
        return;
      }
      if (client.role !== "host" && client.role !== "guest") {
        send(ws, { type: "error", message: "Spectators cannot play." });
        return;
      }

      const game = games[room.game.id];
      if (!game) {
        send(ws, { type: "error", message: "Unknown game." });
        return;
      }

      const result = game.applyMove(room.game.state, message.move, client.playerId);
      if (result?.error) {
        send(ws, { type: "error", message: result.error });
        return;
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
      broadcastRoom(room);
      return;
    }

    send(ws, { type: "error", message: "Unknown message type." });
  });

  ws.on("close", () => {
    const client = clients.get(ws);
    if (!client) return;

    const room = rooms.get(client.roomCode);
    if (!room) {
      clients.delete(ws);
      return;
    }

    const all = [...getRoomPlayers(room), ...room.spectators];
    const player = all.find((entry) => entry.id === client.playerId);
    if (player) {
      player.connected = false;
      if (player.role === "host" || player.role === "guest") {
        player.ready = false;
        if (!room.players.host?.ready || !room.players.guest?.ready) {
          resetRound(room);
        }
      }
    }

    clients.delete(ws);
    touchRoom(room);
    broadcastRoom(room);
  });
});

setInterval(() => {
  const cutoff = now() - ROOM_TTL_MS;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < cutoff) {
      rooms.delete(code);
    }
  }
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`multipass dev server on http://localhost:${PORT}`);
});
