import { createErrorPayload, ERROR_CODES } from "../protocol/errors.js";
import {
  HIGH_RISK_ACTIONS,
  parseInboundMessage,
  validateServerPayload
} from "../protocol/schema.js";

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (forwarded.length) return forwarded[0];
  return req.socket?.remoteAddress || "unknown";
}

function createFixedWindowRateLimiter(windowMs, maxRequests) {
  const buckets = new Map();

  function allow(key) {
    if (!key) return true;
    const current = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || current >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: current + windowMs });
      return true;
    }

    if (bucket.count >= maxRequests) {
      return false;
    }

    bucket.count += 1;
    return true;
  }

  function compact() {
    const current = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (current >= bucket.resetAt) {
        buckets.delete(key);
      }
    }
  }

  return { allow, compact };
}

export function createWsHandler({
  wss,
  roomService,
  logger,
  allowedOrigins = [],
  maxPayloadBytes,
  rateLimitWindowMs,
  rateLimitMaxRequests,
  validateOutgoing = false
}) {
  const clients = new Map();
  const normalizedAllowedOrigins = new Set(
    (allowedOrigins || []).map((origin) => normalizeOrigin(origin)).filter(Boolean)
  );

  const ipRateLimiter = createFixedWindowRateLimiter(rateLimitWindowMs, rateLimitMaxRequests);
  const roomRateLimiter = createFixedWindowRateLimiter(rateLimitWindowMs, rateLimitMaxRequests);

  function send(ws, payload) {
    if (ws.readyState !== ws.OPEN) return;
    if (validateOutgoing && !validateServerPayload(payload)) {
      logger.warn("ws.outbound_invalid", { payloadType: payload?.type || "unknown" });
    }
    ws.send(JSON.stringify(payload));
  }

  function sendError(ws, code, message = null) {
    send(ws, createErrorPayload(code, message));
  }

  function broadcastRoom(room) {
    for (const [ws, client] of clients.entries()) {
      if (client.roomCode !== room.code) continue;
      send(ws, {
        type: "room_state",
        room: roomService.publicRoom(room, { viewerPlayerId: client.playerId }),
        you: {
          clientId: client.clientId,
          playerId: client.playerId,
          role: client.role,
          roomCode: client.roomCode
        }
      });
    }
  }

  function attachClient(ws, room, player, role, clientId, ip) {
    clients.set(ws, {
      ip,
      clientId,
      roomCode: room.code,
      playerId: player?.id ?? null,
      role
    });
  }

  function rateLimitKeyForRoom(type, message, client) {
    if (type === "join_room" || type === "validate_room") {
      return roomService.normalizeRoomCode(message.code || "");
    }
    if (type === "move") {
      return roomService.normalizeRoomCode(client?.roomCode || "");
    }
    return "";
  }

  function shouldRateLimit(type, message, client, ip) {
    if (!HIGH_RISK_ACTIONS.has(type)) return false;

    const ipKey = `${ip}:${type}`;
    const roomKey = rateLimitKeyForRoom(type, message, client);

    const ipAllowed = ipRateLimiter.allow(ipKey);
    const roomAllowed = roomKey ? roomRateLimiter.allow(`${roomKey}:${type}`) : true;

    if (ipAllowed && roomAllowed) return false;

    logger.warn("ws.rate_limited", {
      ip,
      type,
      roomCode: roomKey || null
    });
    return true;
  }

  wss.on("connection", (ws, req) => {
    const ip = getClientIp(req);
    const origin = normalizeOrigin(req.headers.origin || "");

    if (normalizedAllowedOrigins.size > 0 && !normalizedAllowedOrigins.has(origin)) {
      logger.warn("ws.origin_rejected", { ip, origin });
      sendError(ws, ERROR_CODES.ORIGIN_NOT_ALLOWED);
      ws.close(1008, "origin_not_allowed");
      return;
    }

    logger.info("ws.connect", { ip, origin: origin || null });

    ws.on("message", (raw) => {
      ipRateLimiter.compact();
      roomRateLimiter.compact();

      const payloadBytes = Buffer.isBuffer(raw)
        ? raw.length
        : Buffer.byteLength(String(raw || ""), "utf8");

      if (payloadBytes > maxPayloadBytes) {
        sendError(ws, ERROR_CODES.MESSAGE_TOO_LARGE);
        ws.close(1009, "message_too_large");
        logger.warn("ws.message_too_large", { ip, bytes: payloadBytes, maxPayloadBytes });
        return;
      }

      const parsed = parseInboundMessage(raw);
      if (!parsed.ok) {
        sendError(ws, parsed.errorCode || ERROR_CODES.INVALID_PAYLOAD);
        return;
      }

      const { message, type, knownType } = parsed;
      const client = clients.get(ws) || null;

      if (shouldRateLimit(type, message, client, ip)) {
        sendError(ws, ERROR_CODES.RATE_LIMITED);
        return;
      }

      if (!knownType) {
        sendError(ws, ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
        return;
      }

      if (type === "create_room") {
        const avatarId = roomService.getAvatarId(message.avatar);
        const honorific = roomService.normalizeHonorific(message.honorific);
        const clientId = message.clientId || roomService.generateClientId();

        if (!roomService.hasAvatar(avatarId)) {
          sendError(ws, ERROR_CODES.AVATAR_REQUIRED);
          return;
        }

        const room = roomService.createRoom({ avatarId, clientId, honorific });
        if (!room) {
          sendError(ws, ERROR_CODES.ROOM_CREATE_FAILED);
          return;
        }

        attachClient(ws, room, room.players.host, "host", clientId, ip);
        send(ws, { type: "session", clientId, seatToken: room.players.host.seatToken || null });
        broadcastRoom(room);
        logger.info("room.created", { roomCode: room.code, hostId: room.players.host.id, ip });
        return;
      }

      if (type === "join_room") {
        const code = roomService.normalizeRoomCode(message.code);
        const avatarId = roomService.getAvatarId(message.avatar);
        const honorific = roomService.normalizeHonorific(message.honorific);
        const clientId = message.clientId || roomService.generateClientId();
        const seatToken = String(message.seatToken || "").trim() || null;

        const room = roomService.getRoom(code);
        if (!room) {
          sendError(ws, ERROR_CODES.ROOM_NOT_FOUND);
          return;
        }

        const existing = roomService.findRejoinPlayer(room, { seatToken, clientId });
        if (existing) {
          existing.connected = true;
          existing.token = clientId;
          attachClient(ws, room, existing, existing.role, clientId, ip);
          send(ws, { type: "session", clientId, seatToken: existing.seatToken || null });
          roomService.touchRoom(room);
          broadcastRoom(room);
          logger.info("room.rejoin", { roomCode: room.code, playerId: existing.id, ip });
          return;
        }

        if (!roomService.hasAvatar(avatarId)) {
          sendError(ws, ERROR_CODES.AVATAR_REQUIRED);
          return;
        }
        if (roomService.isAvatarTaken(room, avatarId)) {
          sendError(ws, ERROR_CODES.AVATAR_TAKEN);
          return;
        }

        if (room.players.guest) {
          sendError(ws, ERROR_CODES.ROOM_FULL);
          return;
        }

        const joined = roomService.addGuestToRoom(room, { avatarId, honorific, clientId });
        if (!joined.ok) {
          sendError(ws, joined.errorCode, joined.errorMessage);
          return;
        }

        attachClient(ws, room, joined.player, joined.role, clientId, ip);
        send(ws, { type: "session", clientId, seatToken: joined.player.seatToken || null });
        roomService.touchRoom(room);
        broadcastRoom(room);
        logger.info("room.joined", { roomCode: room.code, playerId: joined.player.id, ip });
        return;
      }

      if (type === "validate_room") {
        const code = roomService.normalizeRoomCode(message.code);
        const clientId = message.clientId || null;
        const seatToken = String(message.seatToken || "").trim() || null;
        const room = roomService.getRoom(code);

        if (!room) {
          sendError(ws, ERROR_CODES.ROOM_NOT_FOUND);
          return;
        }

        if (room.players.guest) {
          const existing = roomService.findRejoinPlayer(room, { seatToken, clientId });
          if (existing) {
            send(ws, { type: "room_preview", room: roomService.roomPreview(room, { canRejoin: true }) });
            return;
          }
          sendError(ws, ERROR_CODES.ROOM_FULL);
          return;
        }

        const existing = roomService.findRejoinPlayer(room, { seatToken, clientId });
        send(ws, { type: "room_preview", room: roomService.roomPreview(room, { canRejoin: Boolean(existing) }) });
        return;
      }

      if (!client) {
        sendError(ws, ERROR_CODES.JOIN_REQUIRED);
        return;
      }

      const room = roomService.getRoom(client.roomCode);
      if (!room) {
        sendError(ws, ERROR_CODES.ROOM_NOT_FOUND);
        return;
      }

      if (type === "leave_room") {
        roomService.markPlayerDisconnected(room, client.playerId);
        room.endRequest = null;
        roomService.touchRoom(room);
        clients.delete(ws);
        broadcastRoom(room);
        logger.info("room.left", { roomCode: room.code, playerId: client.playerId, ip });
        return;
      }

      if (type === "ready_up") {
        sendError(ws, ERROR_CODES.DEPRECATED_READY_UP);
        return;
      }

      if (type === "start_round") {
        sendError(ws, ERROR_CODES.DEPRECATED_START_ROUND);
        return;
      }

      if (type === "select_game") {
        if (client.role !== "host" && client.role !== "guest") {
          sendError(ws, ERROR_CODES.SPECTATOR_CANNOT_CHOOSE_GAME);
          return;
        }

        const gameId = String(message.gameId || "").trim();
        const selected = roomService.selectGame(room, client.role, gameId);
        if (!selected.ok) {
          sendError(ws, selected.errorCode, selected.errorMessage);
          return;
        }

        broadcastRoom(room);
        return;
      }

      if (type === "new_round") {
        if (client.role !== "host" && client.role !== "guest") {
          sendError(ws, ERROR_CODES.SPECTATOR_CANNOT_NEW_ROUND);
          return;
        }

        const nextRound = roomService.startNewRound(room);
        if (!nextRound.ok) {
          sendError(ws, nextRound.errorCode, nextRound.errorMessage);
          return;
        }

        broadcastRoom(room);
        return;
      }

      if (type === "end_game_request") {
        if (client.role !== "host" && client.role !== "guest") {
          sendError(ws, ERROR_CODES.SPECTATOR_CANNOT_END_GAME);
          return;
        }

        const requested = roomService.requestEndGame(room, client.playerId);
        if (!requested.ok) {
          sendError(ws, requested.errorCode, requested.errorMessage);
          return;
        }

        broadcastRoom(room);
        return;
      }

      if (type === "end_game_agree") {
        if (client.role !== "host" && client.role !== "guest") {
          sendError(ws, ERROR_CODES.SPECTATOR_CANNOT_END_GAME);
          return;
        }

        const approved = roomService.agreeEndGame(room, client.playerId);
        if (!approved.ok) {
          sendError(ws, approved.errorCode, approved.errorMessage);
          return;
        }

        broadcastRoom(room);
        return;
      }

      if (type === "move") {
        if (client.role !== "host" && client.role !== "guest") {
          sendError(ws, ERROR_CODES.SPECTATOR_CANNOT_PLAY);
          return;
        }

        const requestedGameId = String(message.gameId || "").trim();
        const activeGameId = String(room.game?.id || "");
        if (requestedGameId && activeGameId && requestedGameId !== activeGameId) {
          sendError(ws, ERROR_CODES.INVALID_PAYLOAD, "Move gameId does not match the active game.");
          return;
        }

        const moved = roomService.applyMove(room, message.move, client.playerId);
        if (!moved.ok) {
          sendError(ws, moved.errorCode, moved.errorMessage);
          return;
        }

        broadcastRoom(room);
        return;
      }

      sendError(ws, ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    });

    ws.on("close", () => {
      const client = clients.get(ws);
      if (!client) return;

      const room = roomService.getRoom(client.roomCode);
      if (room) {
        roomService.markPlayerDisconnected(room, client.playerId);
        roomService.touchRoom(room);
        broadcastRoom(room);
      }

      clients.delete(ws);
      logger.info("ws.disconnect", {
        ip: client.ip,
        roomCode: client.roomCode,
        playerId: client.playerId,
        role: client.role
      });
    });

    ws.on("error", (error) => {
      logger.warn("ws.socket_error", {
        ip,
        message: error?.message || String(error)
      });
    });
  });

  return {
    getConnectedClientCount() {
      return clients.size;
    }
  };
}
