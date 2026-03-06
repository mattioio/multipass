export interface WsClient {
  connect(urlOverride?: string | null): WebSocket;
  disconnect(): void;
  send(typeOrPayload: unknown, payload?: Record<string, unknown>): boolean;
  subscribe(
    event: "open" | "close" | "error" | "message",
    callback: (payload: unknown) => void
  ): () => void;
  getSocket(): WebSocket | null;
}

export function createWsClient(options: { getUrl: () => string }): WsClient;
