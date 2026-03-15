export interface WsClientLike {
  connect(urlOverride?: string | null): WebSocket;
  subscribe(event: "open" | "close" | "error" | "message", callback: (payload: any) => void): () => void;
  getSocket(): WebSocket | null;
}

export interface CandidateResolutionOptions {
  envOverrideRaw?: string | null;
  localOverrideRaw?: string | null;
  isDev: boolean;
  protocol: string;
  hostname: string;
  host: string;
  fallbackUrls: string[];
}

export function parseWsUrlList(rawValue: unknown): string[] {
  if (!rawValue) return [];
  return String(rawValue)
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

export function getWebSocketCandidates(options: CandidateResolutionOptions): string[] {
  const envOverrides = parseWsUrlList(options.envOverrideRaw);
  if (envOverrides.length) return [...new Set(envOverrides)];

  const localOverrides = parseWsUrlList(options.localOverrideRaw);
  if (localOverrides.length) return [...new Set(localOverrides)];

  if (options.isDev) {
    const wsProtocol = options.protocol === "https:" ? "wss" : "ws";
    return [`${wsProtocol}://${options.hostname}:3001`];
  }

  if (options.hostname === "localhost" || options.hostname === "127.0.0.1") {
    const wsProtocol = options.protocol === "https:" ? "wss" : "ws";
    return [`${wsProtocol}://${options.host}`];
  }

  return [...new Set(options.fallbackUrls)];
}

export function getPrimaryWebSocketUrl(options: CandidateResolutionOptions): string | null {
  const candidates = getWebSocketCandidates(options);
  return candidates[0] || null;
}

export interface ConnectionManagerOptions {
  wsClient: WsClientLike;
  candidateUrls: string[];
  connectTimeoutMs: number;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  log: (message: string, details?: unknown) => void;
  onSocket: (socket: WebSocket, url: string, attemptIndex: number, totalAttempts: number) => void;
  onOpen: (event: Event) => void;
  onExhausted: () => void;
  onDisconnected: (event: CloseEvent) => void;
  onReconnecting?: (attempt: number, delayMs: number) => void;
  onReconnected?: (event: Event) => void;
  onReconnectFailed?: () => void;
}

export function createConnectionManager(options: ConnectionManagerOptions) {
  const {
    wsClient,
    candidateUrls,
    connectTimeoutMs,
    log,
    onSocket,
    onOpen,
    onExhausted,
    onDisconnected,
    onReconnecting,
    onReconnected,
    onReconnectFailed
  } = options;

  const reconnect = options.reconnect !== false;
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  const reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1000;
  const reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 30000;

  let hasConnected = false;
  let attemptIndex = 0;
  let connectTimeoutId: number | null = null;
  let reconnectTimeoutId: number | null = null;
  let reconnectAttempt = 0;
  let lastSuccessfulUrl: string | null = null;
  let isReconnecting = false;
  let stopped = false;
  const unsubscribers: Array<() => void> = [];

  function clearConnectTimeout() {
    if (connectTimeoutId === null) return;
    window.clearTimeout(connectTimeoutId);
    connectTimeoutId = null;
  }

  function clearReconnectTimeout() {
    if (reconnectTimeoutId === null) return;
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  function getReconnectDelay(attempt: number): number {
    const exponential = reconnectBaseDelayMs * Math.pow(2, attempt);
    const capped = Math.min(exponential, reconnectMaxDelayMs);
    const jitter = Math.random() * reconnectBaseDelayMs * 0.5;
    return capped + jitter;
  }

  function connectAttempt() {
    const url = isReconnecting && lastSuccessfulUrl
      ? lastSuccessfulUrl
      : candidateUrls[Math.min(attemptIndex, candidateUrls.length - 1)];
    clearConnectTimeout();

    if (isReconnecting) {
      log(`reconnecting to ${url} (attempt ${reconnectAttempt + 1}/${maxReconnectAttempts})`);
    } else {
      log(`connecting to ${url} (attempt ${attemptIndex + 1}/${candidateUrls.length})`);
    }

    const socket = wsClient.connect(url);
    onSocket(socket, url, isReconnecting ? reconnectAttempt : attemptIndex, isReconnecting ? maxReconnectAttempts : candidateUrls.length);

    connectTimeoutId = window.setTimeout(() => {
      if (wsClient.getSocket() !== socket) return;
      if (socket.readyState === WebSocket.CONNECTING) {
        log(`connect timeout after ${connectTimeoutMs}ms`, url);
        socket.close();
      }
    }, connectTimeoutMs);
  }

  function scheduleReconnect() {
    if (stopped || !reconnect || reconnectAttempt >= maxReconnectAttempts) {
      isReconnecting = false;
      onReconnectFailed?.();
      return;
    }

    const delay = getReconnectDelay(reconnectAttempt);
    log(`scheduling reconnect attempt ${reconnectAttempt + 1} in ${Math.round(delay)}ms`);
    onReconnecting?.(reconnectAttempt + 1, delay);

    reconnectTimeoutId = window.setTimeout(() => {
      if (stopped) return;
      connectAttempt();
    }, delay);
  }

  function start() {
    stopped = false;
    if (!candidateUrls.length) {
      onExhausted();
      return;
    }

    connectAttempt();

    unsubscribers.push(
      wsClient.subscribe("open", (event: Event) => {
        if ((event as any)?.target && (event as any).target !== wsClient.getSocket()) return;
        clearConnectTimeout();

        if (isReconnecting) {
          isReconnecting = false;
          reconnectAttempt = 0;
          log("reconnected successfully");
          onReconnected?.(event);
          return;
        }

        hasConnected = true;
        lastSuccessfulUrl = candidateUrls[Math.min(attemptIndex, candidateUrls.length - 1)];
        onOpen(event);
      })
    );

    unsubscribers.push(
      wsClient.subscribe("close", (event: CloseEvent) => {
        if ((event as any)?.target && (event as any).target !== wsClient.getSocket()) return;
        clearConnectTimeout();

        // During initial connection: try next candidate
        if (!hasConnected && !isReconnecting && attemptIndex < candidateUrls.length - 1) {
          attemptIndex += 1;
          connectAttempt();
          return;
        }

        // Initial connection exhausted all candidates
        if (!hasConnected && !isReconnecting) {
          onExhausted();
          return;
        }

        // During reconnection: schedule next attempt
        if (isReconnecting) {
          reconnectAttempt += 1;
          scheduleReconnect();
          return;
        }

        // Post-connection drop: start reconnecting
        onDisconnected(event);
        if (reconnect && lastSuccessfulUrl) {
          isReconnecting = true;
          reconnectAttempt = 0;
          scheduleReconnect();
        }
      })
    );
  }

  function stop() {
    stopped = true;
    clearConnectTimeout();
    clearReconnectTimeout();
    isReconnecting = false;
    reconnectAttempt = 0;
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  return {
    start,
    stop,
    getAttemptCount() {
      return attemptIndex + 1;
    },
    isReconnecting() {
      return isReconnecting;
    }
  };
}
