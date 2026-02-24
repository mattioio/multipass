import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import { createMultipassServer } from "../../src/bootstrap/server.js";

let nextPort = 3310;

function reservePort() {
  const port = nextPort;
  nextPort += 1;
  return port;
}

async function startServer(overrides = {}) {
  const port = reservePort();
  const app = createMultipassServer({
    port,
    serveStatic: false,
    ...overrides
  });

  await new Promise((resolve, reject) => {
    app.server.once("error", reject);
    app.server.listen(port, () => resolve(undefined));
  });

  return { app, wsUrl: `ws://127.0.0.1:${port}` };
}

function connectSocket(wsUrl, origin = null) {
  return new Promise((resolve, reject) => {
    const ws = origin
      ? new WebSocket(wsUrl, { headers: { Origin: origin } })
      : new WebSocket(wsUrl);

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error("Timed out connecting."));
    }, 8000);

    ws.once("open", () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForMessage(ws, predicate, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("Timed out waiting for message."));
    }, timeoutMs);

    function onMessage(raw) {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      clearTimeout(timeout);
      ws.off("message", onMessage);
      resolve(message);
    }

    ws.on("message", onMessage);
  });
}

test("rejects disallowed origins", async () => {
  const { app, wsUrl } = await startServer({
    wsAllowedOrigins: ["https://allowed.example.com"]
  });

  try {
    const ws = await connectSocket(wsUrl, "https://blocked.example.com");

    const result = await new Promise((resolve) => {
      let errorMessage = null;
      ws.on("message", (raw) => {
        try {
          errorMessage = JSON.parse(raw.toString());
        } catch {
          errorMessage = null;
        }
      });
      ws.on("close", (code) => resolve({ code, errorMessage }));
    });

    expect(result.code).toBe(1008);
    if (result.errorMessage) {
      expect(result.errorMessage.code).toBe("ORIGIN_NOT_ALLOWED");
    }
  } finally {
    app.stop();
  }
});

test("accepts allowed origin and returns session payload", async () => {
  const { app, wsUrl } = await startServer({
    wsAllowedOrigins: ["https://allowed.example.com"]
  });

  try {
    const ws = await connectSocket(wsUrl, "https://allowed.example.com");

    const sessionPromise = waitForMessage(ws, (message) => message.type === "session");
    ws.send(JSON.stringify({ type: "create_room", avatar: "yellow", honorific: "mr" }));

    const session = await sessionPromise;
    expect(typeof session.clientId).toBe("string");
    expect(typeof session.seatToken).toBe("string");

    ws.close();
  } finally {
    app.stop();
  }
});

test("closes oversized payloads", async () => {
  const { app, wsUrl } = await startServer({
    wsMaxPayloadBytes: 128
  });

  try {
    const ws = await connectSocket(wsUrl);

    const closePromise = new Promise((resolve) => {
      ws.on("close", (code) => resolve(code));
    });

    ws.send("x".repeat(2048));
    const closeCode = await closePromise;

    expect(closeCode).toBe(1009);
  } finally {
    app.stop();
  }
});

test("returns INVALID_JSON for malformed payloads", async () => {
  const { app, wsUrl } = await startServer();

  try {
    const ws = await connectSocket(wsUrl);
    const errorPromise = waitForMessage(
      ws,
      (message) => message.type === "error" && message.code === "INVALID_JSON"
    );

    ws.send("{");
    const error = await errorPromise;
    expect(error.message).toBe("Invalid JSON.");
    ws.close();
  } finally {
    app.stop();
  }
});

test("rate limits high-risk websocket actions", async () => {
  const { app, wsUrl } = await startServer({
    wsRateLimitWindowMs: 60_000,
    wsRateLimitMaxRequests: 3
  });

  try {
    const ws = await connectSocket(wsUrl);
    const errorPromise = waitForMessage(
      ws,
      (message) => message.type === "error" && message.code === "RATE_LIMITED"
    );

    for (let index = 0; index < 6; index += 1) {
      ws.send(JSON.stringify({
        type: "create_room",
        avatar: "yellow",
        honorific: "mr",
        clientId: `rl_${index}`
      }));
    }

    const error = await errorPromise;
    expect(error.message).toBe("Too many requests. Try again in a moment.");
    ws.close();
  } finally {
    app.stop();
  }
});
