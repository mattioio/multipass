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
  log: (message: string, details?: unknown) => void;
  onSocket: (socket: WebSocket, url: string, attemptIndex: number, totalAttempts: number) => void;
  onOpen: (event: Event) => void;
  onExhausted: () => void;
  onDisconnected: (event: CloseEvent) => void;
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
    onDisconnected
  } = options;

  let hasConnected = false;
  let attemptIndex = 0;
  let connectTimeoutId: number | null = null;
  const unsubscribers: Array<() => void> = [];

  function clearConnectTimeout() {
    if (connectTimeoutId === null) return;
    window.clearTimeout(connectTimeoutId);
    connectTimeoutId = null;
  }

  function connectAttempt() {
    const url = candidateUrls[Math.min(attemptIndex, candidateUrls.length - 1)];
    clearConnectTimeout();
    log(`connecting to ${url} (attempt ${attemptIndex + 1}/${candidateUrls.length})`);

    const socket = wsClient.connect(url);
    onSocket(socket, url, attemptIndex, candidateUrls.length);

    connectTimeoutId = window.setTimeout(() => {
      if (hasConnected) return;
      if (wsClient.getSocket() !== socket) return;
      if (socket.readyState === WebSocket.CONNECTING) {
        log(`connect timeout after ${connectTimeoutMs}ms`, url);
        socket.close();
      }
    }, connectTimeoutMs);
  }

  function start() {
    if (!candidateUrls.length) {
      onExhausted();
      return;
    }

    connectAttempt();

    unsubscribers.push(
      wsClient.subscribe("open", (event: Event) => {
        if ((event as any)?.target && (event as any).target !== wsClient.getSocket()) return;
        hasConnected = true;
        clearConnectTimeout();
        onOpen(event);
      })
    );

    unsubscribers.push(
      wsClient.subscribe("close", (event: CloseEvent) => {
        if ((event as any)?.target && (event as any).target !== wsClient.getSocket()) return;
        clearConnectTimeout();

        if (!hasConnected && attemptIndex < candidateUrls.length - 1) {
          attemptIndex += 1;
          connectAttempt();
          return;
        }

        if (!hasConnected) {
          onExhausted();
          return;
        }

        onDisconnected(event);
      })
    );
  }

  function stop() {
    clearConnectTimeout();
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  return {
    start,
    stop,
    getAttemptCount() {
      return attemptIndex + 1;
    }
  };
}
