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

test("create_room accepts legacy fruit payload", async () => {
  const ws = await connectSocket();

  ws.send(JSON.stringify({ type: "create_room", fruit: "banana" }));

  const session = await waitForMessage(ws, (message) => message.type === "session");
  expect(session.clientId).toMatch(/^client_/);

  const roomState = await waitForMessage(
    ws,
    (message) => message.type === "room_state" && message.room?.players?.host?.theme === "yellow"
  );

  expect(roomState.room.players.host.theme).toBe("yellow");

  ws.close();
});

test("join_room accepts legacy fruit payload", async () => {
  const host = await connectSocket();
  host.send(JSON.stringify({ type: "create_room", avatar: "yellow" }));

  await waitForMessage(host, (message) => message.type === "session");
  const hostRoom = await waitForMessage(
    host,
    (message) => message.type === "room_state" && Boolean(message.room?.code)
  );

  const guest = await connectSocket();
  guest.send(JSON.stringify({ type: "join_room", code: hostRoom.room.code, fruit: "kiwi" }));

  await waitForMessage(guest, (message) => message.type === "session");
  const guestRoom = await waitForMessage(
    guest,
    (message) => message.type === "room_state" && message.room?.players?.guest?.theme === "green"
  );

  expect(guestRoom.room.players.guest.theme).toBe("green");

  host.close();
  guest.close();
});
