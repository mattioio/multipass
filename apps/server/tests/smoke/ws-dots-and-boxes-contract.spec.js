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

function waitForMessage(ws, predicate, timeoutMs = 8000, label = "message") {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`Timed out waiting for websocket message (${label}).`));
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

test("dots and boxes enforces alternation, extra turns on box completion, and syncs state", async () => {
  const host = await connectSocket();
  const hostSession = waitForMessage(host, (message) => message.type === "session", 8000, "host session");
  const hostRoomCreated = waitForMessage(
    host,
    (message) => message.type === "room_state" && Boolean(message.room?.code),
    8000,
    "host room created"
  );

  host.send(JSON.stringify({ type: "create_room", avatar: "yellow", honorific: "mr" }));
  await hostSession;
  const hostRoom = await hostRoomCreated;
  const roomCode = hostRoom.room.code;

  const guest = await connectSocket();
  const guestSession = waitForMessage(guest, (message) => message.type === "session", 8000, "guest session");
  const guestJoined = waitForMessage(
    guest,
    (message) => message.type === "room_state" && Boolean(message.room?.players?.guest?.id),
    8000,
    "guest joined"
  );

  guest.send(JSON.stringify({ type: "join_room", code: roomCode, avatar: "green", honorific: "mr" }));
  await guestSession;
  await guestJoined;

  host.send(JSON.stringify({ type: "select_game", gameId: "dots_and_boxes" }));
  const roundStartedPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.id === "dots_and_boxes",
    8000,
    "dots round started"
  );
  guest.send(JSON.stringify({ type: "select_game", gameId: "dots_and_boxes" }));
  const roundStarted = await roundStartedPromise;

  const hostId = roundStarted.room.players.host.id;
  const guestId = roundStarted.room.players.guest.id;
  expect(roundStarted.room.round.firstPlayerId).toBe(hostId);
  expect(roundStarted.room.game.state.nextPlayerId).toBe(hostId);
  expect(roundStarted.room.game.state.edges).toHaveLength(60);
  expect(roundStarted.room.game.state.boxes).toHaveLength(25);

  const doMove = async (ws, playerId, edgeIndex, expectedHistoryLength, label) => {
    const updatePromise = waitForMessage(
      host,
      (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === expectedHistoryLength,
      8000,
      label
    );
    ws.send(JSON.stringify({ type: "move", move: { edgeIndex } }));
    const update = await updatePromise;
    expect(update.room.game.state.history.at(-1)).toMatchObject({ playerId, edgeIndex });
    return update;
  };

  let update = await doMove(host, hostId, 0, 1, "host move 1");
  expect(update.room.game.state.nextPlayerId).toBe(guestId);

  update = await doMove(guest, guestId, 10, 2, "guest move 1");
  expect(update.room.game.state.nextPlayerId).toBe(hostId);

  update = await doMove(host, hostId, 30, 3, "host move 2");
  expect(update.room.game.state.nextPlayerId).toBe(guestId);

  update = await doMove(guest, guestId, 11, 4, "guest move 2");
  expect(update.room.game.state.nextPlayerId).toBe(hostId);

  update = await doMove(host, hostId, 5, 5, "host move 3");
  expect(update.room.game.state.nextPlayerId).toBe(guestId);

  update = await doMove(guest, guestId, 12, 6, "guest move 3");
  expect(update.room.game.state.nextPlayerId).toBe(hostId);

  update = await doMove(host, hostId, 31, 7, "host scoring move");
  expect(update.room.game.state.boxes[0]).toBe(hostId);
  expect(update.room.game.state.scores[hostId]).toBe(1);
  expect(update.room.game.state.scores[guestId]).toBe(0);
  expect(update.room.game.state.nextPlayerId).toBe(hostId);
  expect(update.room.game.state.history.at(-1).completedBoxIndices).toEqual([0]);

  const guestSynced = await waitForMessage(
    guest,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 7,
    8000,
    "guest sync"
  );
  expect(guestSynced.room.game.state.edges[31]).toBe(hostId);
  expect(guestSynced.room.game.state.boxes[0]).toBe(hostId);

  host.close();
  guest.close();
});
