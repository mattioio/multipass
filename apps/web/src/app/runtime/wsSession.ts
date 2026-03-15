import { assertRoomShape } from "../../contracts/roomState.js";
import { createWsClient } from "../../net/wsClient.js";
import {
  createConnectionManager,
  getPrimaryWebSocketUrl,
  getWebSocketCandidates,
  type CandidateResolutionOptions
} from "../../net/connectionManager";
import {
  buildJoinRoomMessage,
  buildValidateRoomMessage,
  parseServerMessage
} from "../../net/protocolAdapter";
import type { RoomState, RuntimeJoinPreviewPlayer, RuntimeState } from "../../types";
import { runtimeActions, type RuntimeDispatch } from "./actions";
import { persistClientSession, persistLastRoom } from "./persistence";

const WS_CONNECT_ATTEMPT_TIMEOUT_MS = 2600;
const PROD_WS_FALLBACK_URLS = Object.freeze([
  "wss://api.loreandorder.com"
]);

function resolveCandidateOptions(): CandidateResolutionOptions {
  const localOverrideRaw = (() => {
    try {
      return localStorage.getItem("multipass_ws_url");
    } catch {
      return null;
    }
  })();
  return {
    envOverrideRaw: import.meta.env.VITE_WS_URL ?? null,
    localOverrideRaw,
    isDev: Boolean(import.meta.env.DEV),
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    host: window.location.host,
    fallbackUrls: [...PROD_WS_FALLBACK_URLS]
  };
}

interface RuntimeWsSessionOptions {
  dispatch: RuntimeDispatch;
  getState: () => RuntimeState;
  log?: (message: string, details?: unknown) => void;
}

function asRoomState(raw: unknown): RoomState | null {
  if (!assertRoomShape(raw)) return null;
  return raw;
}

function asJoinPreviewPlayer(raw: unknown): RuntimeJoinPreviewPlayer | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const honorificRaw = typeof candidate.honorific === "string" ? candidate.honorific.trim().toLowerCase() : "";
  const honorific = honorificRaw === "mrs" ? "mrs" : (honorificRaw === "mr" ? "mr" : undefined);

  return {
    id: typeof candidate.id === "string" ? candidate.id : null,
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    honorific,
    theme: typeof candidate.theme === "string" ? candidate.theme : undefined,
    role: typeof candidate.role === "string" ? candidate.role : undefined,
    score: typeof candidate.score === "number" ? candidate.score : undefined,
    gamesWon: typeof candidate.gamesWon === "number" ? candidate.gamesWon : undefined,
    ready: typeof candidate.ready === "boolean" ? candidate.ready : undefined,
    connected: typeof candidate.connected === "boolean" ? candidate.connected : undefined
  };
}

export interface RuntimeWsSession {
  connect: () => void;
  disconnect: () => void;
  send: (payload: unknown) => boolean;
  validateRoom: (code: string) => void;
  joinRoom: (code: string, avatar?: string | null, honorific?: "mr" | "mrs" | null) => void;
  createRoom: (avatar: string, honorific?: "mr" | "mrs" | null) => void;
}

export function createRuntimeWsSession(options: RuntimeWsSessionOptions): RuntimeWsSession {
  const dispatch = options.dispatch;
  const getState = options.getState;
  const log = options.log ?? (() => {});

  const wsClient = createWsClient({
    getUrl: () => getPrimaryWebSocketUrl(resolveCandidateOptions()) || PROD_WS_FALLBACK_URLS[0]
  });

  let connectionManager: ReturnType<typeof createConnectionManager> | null = null;
  let pendingValidateCode: string | null = null;
  const unsubscribers: Array<() => void> = [];

  function teardownSubscriptions() {
    while (unsubscribers.length > 0) {
      unsubscribers.pop()?.();
    }
  }

  function send(payload: unknown) {
    return wsClient.send(payload);
  }

  function sendValidateRoom(code: string) {
    const state = getState();
    return send(buildValidateRoomMessage({
      code,
      clientId: state.clientId,
      seatToken: state.seatToken
    }));
  }

  function flushPendingValidate() {
    if (!pendingValidateCode) return;
    if (!sendValidateRoom(pendingValidateCode)) return;
    pendingValidateCode = null;
  }

  function handleMessage(rawMessage: unknown) {
    const parsed = parseServerMessage(rawMessage);

    if (parsed.kind === "session") {
      const clientId = parsed.message.clientId || null;
      const seatToken = parsed.message.seatToken ?? null;
      dispatch(runtimeActions.sessionReceived(clientId, seatToken));
      persistClientSession({ clientId, seatToken });
      return;
    }

    if (parsed.kind === "room_state") {
      const room = asRoomState(parsed.message.room);
      if (!room) return;
      const you = parsed.message.you
        ? {
            clientId: parsed.message.you.clientId || null,
            playerId: parsed.message.you.playerId || null,
            role: parsed.message.you.role || null,
            roomCode: parsed.message.you.roomCode || null
          }
        : null;
      dispatch(runtimeActions.roomStateReceived(room, you));
      persistLastRoom({
        code: room.code || null,
        startedAt: Number(room.createdAt || Date.now())
      });
      return;
    }

    if (parsed.kind === "room_preview") {
      const previewRaw = parsed.message.room as Record<string, unknown>;
      dispatch(runtimeActions.joinReady({
        code: typeof previewRaw.code === "string" ? previewRaw.code : undefined,
        canRejoin: typeof previewRaw.canRejoin === "boolean" ? previewRaw.canRejoin : undefined,
        takenThemes: Array.isArray(previewRaw.takenThemes)
          ? previewRaw.takenThemes.filter((entry): entry is string => typeof entry === "string")
          : undefined,
        host: asJoinPreviewPlayer(previewRaw.host),
        guest: asJoinPreviewPlayer(previewRaw.guest)
      }, ""));
      return;
    }

    if (parsed.kind === "error") {
      dispatch(runtimeActions.joinError(parsed.message.message || "Unexpected room error"));
    }
  }

  function connect() {
    if (typeof window.WebSocket !== "function") {
      log("WebSocket runtime unavailable; skipping runtime connection setup.");
      return;
    }
    teardownSubscriptions();
    connectionManager?.stop();

    const candidates = getWebSocketCandidates(resolveCandidateOptions());
    connectionManager = createConnectionManager({
      wsClient,
      candidateUrls: candidates,
      connectTimeoutMs: WS_CONNECT_ATTEMPT_TIMEOUT_MS,
      log,
      onSocket(socket) {
        dispatch(runtimeActions.wsSet(socket));
        dispatch(runtimeActions.connectionStatusSet("connecting"));
      },
      onOpen() {
        dispatch(runtimeActions.connectionStatusSet("connected"));
        flushPendingValidate();
      },
      onExhausted() {
        dispatch(runtimeActions.connectionStatusSet("disconnected"));
      },
      onDisconnected() {
        dispatch(runtimeActions.connectionStatusSet("disconnected"));
      },
      onReconnecting() {
        dispatch(runtimeActions.connectionStatusSet("reconnecting"));
      },
      onReconnected() {
        dispatch(runtimeActions.connectionStatusSet("connected"));
        flushPendingValidate();
        // Re-join room if we were in one before disconnecting
        const currentState = getState();
        if (currentState.you?.roomCode && currentState.clientId) {
          send(buildJoinRoomMessage({
            code: currentState.you.roomCode,
            clientId: currentState.clientId,
            seatToken: currentState.seatToken
          }));
        }
      },
      onReconnectFailed() {
        dispatch(runtimeActions.connectionStatusSet("disconnected"));
      }
    });

    unsubscribers.push(
      wsClient.subscribe("message", handleMessage),
      wsClient.subscribe("error", () => {
        dispatch(runtimeActions.connectionStatusSet("disconnected"));
      }),
      wsClient.subscribe("close", () => {
        dispatch(runtimeActions.wsSet(null));
      })
    );

    connectionManager.start();
  }

  function disconnect() {
    teardownSubscriptions();
    connectionManager?.stop();
    connectionManager = null;
    wsClient.disconnect();
    dispatch(runtimeActions.wsSet(null));
    dispatch(runtimeActions.connectionStatusSet("disconnected"));
  }

  function validateRoom(code: string) {
    dispatch(runtimeActions.joinValidating());
    pendingValidateCode = code;
    flushPendingValidate();
  }

  function joinRoom(code: string, avatar?: string | null, honorific?: "mr" | "mrs" | null) {
    const state = getState();
    send(buildJoinRoomMessage({
      code,
      clientId: state.clientId,
      seatToken: state.seatToken,
      avatar: avatar || null,
      honorific: honorific || null
    }));
  }

  function createRoom(avatar: string, honorific: "mr" | "mrs" | null = "mr") {
    const state = getState();
    send({
      type: "create_room",
      avatar,
      honorific: honorific || "mr",
      ...(state.clientId ? { clientId: state.clientId } : {}),
      ...(state.seatToken ? { seatToken: state.seatToken } : {})
    });
  }

  return {
    connect,
    disconnect,
    send,
    validateRoom,
    joinRoom,
    createRoom
  };
}
