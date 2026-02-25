import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";

const WS_URL = "ws://127.0.0.1:3001";

function connectSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error("Timed out connecting to websocket server."));
    }, 8000);

    ws.once("open", () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function waitForMessage(ws, predicate, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("Timed out waiting for websocket message."));
    }, timeoutMs);

    function onMessage(raw) {
      const parsed = JSON.parse(raw.toString());
      if (!predicate(parsed)) return;
      clearTimeout(timeout);
      ws.off("message", onMessage);
      resolve(parsed);
    }

    ws.on("message", onMessage);
  });
}

test("create_room rejects deprecated alias payload", async () => {
  const ws = await connectSocket();

  const errorPromise = waitForMessage(ws, (message) => message.type === "error");
  ws.send(JSON.stringify({ type: "create_room", fruit: "banana" }));
  const error = await errorPromise;

  expect(error.code).toBe("AVATAR_REQUIRED");
  expect(error.message).toBe("Pick an avatar.");
  ws.close();
});

test("create_room honors explicit honorific", async () => {
  const ws = await connectSocket();

  const sessionPromise = waitForMessage(ws, (message) => message.type === "session");
  const roomPromise = waitForMessage(
    ws,
    (message) => message.type === "room_state" && message.room?.players?.host?.theme === "yellow"
  );
  ws.send(JSON.stringify({ type: "create_room", avatar: "yellow", honorific: "mrs" }));
  const session = await sessionPromise;
  const roomState = await roomPromise;

  expect(typeof session.seatToken).toBe("string");
  expect(roomState.room.players.host.name).toBe("Mrs Yellow");
  expect(roomState.room.players.host.honorific).toBe("mrs");

  ws.close();
});

test("join_room honors explicit honorific independently", async () => {
  const host = await connectSocket();
  const hostSessionPromise = waitForMessage(host, (message) => message.type === "session");
  const hostRoomPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && Boolean(message.room?.code)
  );
  host.send(JSON.stringify({ type: "create_room", avatar: "yellow", honorific: "mr" }));

  await hostSessionPromise;
  const hostRoom = await hostRoomPromise;

  const guest = await connectSocket();
  const guestSessionPromise = waitForMessage(guest, (message) => message.type === "session");
  const guestRoomPromise = waitForMessage(
    guest,
    (message) => message.type === "room_state" && message.room?.players?.guest?.theme === "green"
  );
  guest.send(JSON.stringify({
    type: "join_room",
    code: hostRoom.room.code,
    avatar: "green",
    honorific: "mrs"
  }));

  await guestSessionPromise;
  const guestRoom = await guestRoomPromise;

  expect(guestRoom.room.players.host.name).toBe("Mr Yellow");
  expect(guestRoom.room.players.host.honorific).toBe("mr");
  expect(guestRoom.room.players.guest.name).toBe("Mrs Green");
  expect(guestRoom.room.players.guest.honorific).toBe("mrs");

  host.close();
  guest.close();
});

test("validate_room returns room_preview contract", async () => {
  const host = await connectSocket();
  const hostSessionPromise = waitForMessage(host, (message) => message.type === "session");
  const hostRoomPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && Boolean(message.room?.code)
  );
  host.send(JSON.stringify({ type: "create_room", avatar: "yellow", honorific: "mr" }));

  const hostSession = await hostSessionPromise;
  const hostRoom = await hostRoomPromise;

  const guest = await connectSocket();
  const previewPromise = waitForMessage(guest, (message) => message.type === "room_preview");
  guest.send(JSON.stringify({
    type: "validate_room",
    code: hostRoom.room.code,
    clientId: hostSession.clientId,
    seatToken: hostSession.seatToken
  }));

  const preview = await previewPromise;
  expect(preview.room.code).toBe(hostRoom.room.code);
  expect(typeof preview.room.canRejoin).toBe("boolean");
  expect(Array.isArray(preview.room.takenThemes)).toBeTruthy();

  host.close();
  guest.close();
});

test("invalid json returns a typed protocol error", async () => {
  const ws = await connectSocket();
  const errorPromise = waitForMessage(
    ws,
    (message) => message.type === "error" && message.code === "INVALID_JSON"
  );
  ws.send("{");
  const error = await errorPromise;
  expect(error.message).toBe("Invalid JSON.");
  ws.close();
});

test("rate limiting returns a typed protocol error", async () => {
  const ws = await connectSocket();

  const rateLimitedPromise = waitForMessage(
    ws,
    (message) => message.type === "error" && message.code === "RATE_LIMITED",
    12_000
  );

  for (let index = 0; index < 110; index += 1) {
    ws.send(JSON.stringify({
      type: "validate_room",
      code: "ABCD",
      clientId: `load_test_${index}`
    }));
  }

  const rateLimited = await rateLimitedPromise;
  expect(rateLimited.message).toBe("Too many requests. Try again in a moment.");

  ws.close();
});

test("health and readiness endpoints return service status", async () => {
  const healthResponse = await fetch("http://127.0.0.1:3001/healthz");
  expect(healthResponse.status).toBe(200);
  const healthPayload = await healthResponse.json();
  expect(healthPayload.status).toBe("ok");
  expect(typeof healthPayload.timestamp).toBe("number");

  const readyResponse = await fetch("http://127.0.0.1:3001/readyz");
  expect(readyResponse.status).toBe(200);
  const readyPayload = await readyResponse.json();
  expect(readyPayload.status).toBe("ready");
  expect(readyPayload.checks?.gameRegistry).toBe("ok");
});
