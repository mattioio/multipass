import { describe, expect, it, vi } from "vitest";
import {
  createConnectionManager,
  getWebSocketCandidates,
  parseWsUrlList
} from "../connectionManager";

class FakeWsClient {
  private listeners = new Map<string, Set<(payload: any) => void>>();
  public socket: WebSocket | null = null;
  public connectUrls: string[] = [];

  connect(urlOverride?: string | null) {
    const socket = {
      readyState: WebSocket.CONNECTING,
      close: vi.fn()
    } as unknown as WebSocket;
    this.socket = socket;
    this.connectUrls.push(urlOverride || "");
    return socket;
  }

  subscribe(event: "open" | "close" | "error" | "message", callback: (payload: any) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: "open" | "close" | "error" | "message", payload: any) {
    this.listeners.get(event)?.forEach((callback) => callback(payload));
  }

  getSocket() {
    return this.socket;
  }
}

describe("parseWsUrlList", () => {
  it("splits comma-separated urls", () => {
    expect(parseWsUrlList(" ws://one , ws://two ")).toEqual(["ws://one", "ws://two"]);
  });
});

describe("getWebSocketCandidates", () => {
  it("prefers env override list", () => {
    const candidates = getWebSocketCandidates({
      envOverrideRaw: "wss://primary.example.com,wss://backup.example.com",
      localOverrideRaw: "wss://local.example.com",
      isDev: true,
      protocol: "https:",
      hostname: "example.com",
      host: "example.com",
      fallbackUrls: ["wss://fallback.example.com"]
    });

    expect(candidates).toEqual(["wss://primary.example.com", "wss://backup.example.com"]);
  });

  it("uses local override when env is absent", () => {
    const candidates = getWebSocketCandidates({
      envOverrideRaw: "",
      localOverrideRaw: "wss://local.example.com,wss://local-backup.example.com",
      isDev: false,
      protocol: "https:",
      hostname: "example.com",
      host: "example.com",
      fallbackUrls: ["wss://fallback.example.com"]
    });

    expect(candidates).toEqual(["wss://local.example.com", "wss://local-backup.example.com"]);
  });
});

describe("createConnectionManager", () => {
  it("fails over to next candidate before first successful connection", () => {
    const wsClient = new FakeWsClient();
    const onOpen = vi.fn();
    const onExhausted = vi.fn();
    const onDisconnected = vi.fn();

    const manager = createConnectionManager({
      wsClient,
      candidateUrls: ["ws://one", "ws://two"],
      connectTimeoutMs: 500,
      log: vi.fn(),
      onSocket: vi.fn(),
      onOpen,
      onExhausted,
      onDisconnected
    });

    manager.start();
    expect(wsClient.connectUrls).toEqual(["ws://one"]);

    const firstSocket = wsClient.getSocket();
    wsClient.emit("close", { target: firstSocket });

    expect(wsClient.connectUrls).toEqual(["ws://one", "ws://two"]);
    expect(onExhausted).not.toHaveBeenCalled();
    expect(onDisconnected).not.toHaveBeenCalled();

    const secondSocket = wsClient.getSocket();
    wsClient.emit("open", { target: secondSocket });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onExhausted when all candidates fail before first open", () => {
    const wsClient = new FakeWsClient();
    const onExhausted = vi.fn();

    const manager = createConnectionManager({
      wsClient,
      candidateUrls: ["ws://one"],
      connectTimeoutMs: 500,
      log: vi.fn(),
      onSocket: vi.fn(),
      onOpen: vi.fn(),
      onExhausted,
      onDisconnected: vi.fn()
    });

    manager.start();
    const socket = wsClient.getSocket();
    wsClient.emit("close", { target: socket });

    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it("calls onDisconnected after a successful open", () => {
    const wsClient = new FakeWsClient();
    const onDisconnected = vi.fn();

    const manager = createConnectionManager({
      wsClient,
      candidateUrls: ["ws://one"],
      connectTimeoutMs: 500,
      log: vi.fn(),
      onSocket: vi.fn(),
      onOpen: vi.fn(),
      onExhausted: vi.fn(),
      onDisconnected
    });

    manager.start();
    const socket = wsClient.getSocket();
    wsClient.emit("open", { target: socket });
    wsClient.emit("close", { target: socket, code: 1006 });

    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });
});
