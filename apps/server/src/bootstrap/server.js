import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createLogger } from "../infra/logger.js";
import { createHttpRequestHandler } from "../http/routes.js";
import { createWsHandler } from "../ws/handler.js";
import { createGameService } from "../domain/games/service.js";
import { createRoomStore } from "../domain/rooms/store.js";
import { createRoomService } from "../domain/rooms/service.js";

const DEFAULT_PORT = 3000;
const DEFAULT_ROOM_TTL_MS = 90 * 60 * 1000;
const DEFAULT_WS_MAX_PAYLOAD_BYTES = 64 * 1024;
const DEFAULT_WS_RATE_LIMIT_WINDOW_MS = 10_000;
const DEFAULT_WS_RATE_LIMIT_MAX_REQUESTS = 80;
const DEFAULT_PRUNE_INTERVAL_MS = 60_000;
const DEFAULT_PUBLIC_FRONTEND_ORIGINS = Object.freeze([
  "https://mattioio.github.io",
  "https://multipass.loreandorder.com"
]);

function parseInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeOrigins(origins) {
  return [...new Set((origins || []).map((origin) => String(origin || "").trim()).filter(Boolean))];
}

function resolveDefaultWebRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../../../web");
}

export function createMultipassServer(overrides = {}) {
  const envAllowedOrigins = parseOrigins(process.env.WS_ALLOWED_ORIGINS);
  const effectiveAllowedOrigins = overrides.wsAllowedOrigins
    ?? (envAllowedOrigins.length > 0
      ? mergeOrigins([...envAllowedOrigins, ...DEFAULT_PUBLIC_FRONTEND_ORIGINS])
      : []);

  const config = {
    port: parseInteger(overrides.port ?? process.env.PORT, DEFAULT_PORT),
    roomTtlMs: parseInteger(overrides.roomTtlMs ?? process.env.ROOM_TTL_MS, DEFAULT_ROOM_TTL_MS),
    wsMaxPayloadBytes: parseInteger(
      overrides.wsMaxPayloadBytes ?? process.env.WS_MAX_PAYLOAD_BYTES,
      DEFAULT_WS_MAX_PAYLOAD_BYTES
    ),
    wsRateLimitWindowMs: parseInteger(
      overrides.wsRateLimitWindowMs ?? process.env.WS_RATE_LIMIT_WINDOW_MS,
      DEFAULT_WS_RATE_LIMIT_WINDOW_MS
    ),
    wsRateLimitMaxRequests: parseInteger(
      overrides.wsRateLimitMaxRequests ?? process.env.WS_RATE_LIMIT_MAX_REQUESTS,
      DEFAULT_WS_RATE_LIMIT_MAX_REQUESTS
    ),
    wsAllowedOrigins: effectiveAllowedOrigins,
    serveStatic: overrides.serveStatic ?? process.env.SERVE_STATIC !== "false",
    webRoot: overrides.webRoot || resolveDefaultWebRoot(),
    pruneIntervalMs: parseInteger(overrides.pruneIntervalMs, DEFAULT_PRUNE_INTERVAL_MS)
  };

  const logger = overrides.logger || createLogger("server");

  const gameService = createGameService();
  const roomStore = createRoomStore();
  const roomService = createRoomService({
    store: roomStore,
    gameService,
    roomTtlMs: config.roomTtlMs
  });

  const requestHandler = createHttpRequestHandler({
    webRoot: config.webRoot,
    roomService,
    logger: logger.child("http"),
    serveStatic: config.serveStatic
  });

  const server = http.createServer(requestHandler);
  const wss = new WebSocketServer({
    server,
    maxPayload: config.wsMaxPayloadBytes
  });

  const wsHandler = createWsHandler({
    wss,
    roomService,
    logger: logger.child("ws"),
    allowedOrigins: config.wsAllowedOrigins,
    maxPayloadBytes: config.wsMaxPayloadBytes,
    rateLimitWindowMs: config.wsRateLimitWindowMs,
    rateLimitMaxRequests: config.wsRateLimitMaxRequests,
    validateOutgoing: process.env.NODE_ENV !== "production"
  });

  const pruneTimer = setInterval(() => {
    roomService.pruneExpiredRooms();
  }, config.pruneIntervalMs);

  if (typeof pruneTimer.unref === "function") {
    pruneTimer.unref();
  }

  function start() {
    server.listen(config.port, () => {
      logger.info("server.started", {
        port: config.port,
        serveStatic: config.serveStatic,
        webRoot: config.webRoot,
        wsMaxPayloadBytes: config.wsMaxPayloadBytes,
        wsRateLimitWindowMs: config.wsRateLimitWindowMs,
        wsRateLimitMaxRequests: config.wsRateLimitMaxRequests,
        wsAllowedOrigins: config.wsAllowedOrigins,
        connectedClients: wsHandler.getConnectedClientCount()
      });
    });
  }

  function stop() {
    clearInterval(pruneTimer);
    wss.close();
    server.close();
  }

  return {
    config,
    server,
    wss,
    roomService,
    start,
    stop
  };
}
