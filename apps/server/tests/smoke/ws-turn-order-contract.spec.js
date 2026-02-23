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

test("starter is host in round 1, then alternates to guest in round 2", async () => {
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

  host.send(JSON.stringify({ type: "select_game", gameId: "tic_tac_toe" }));
  const roundOneStartedPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.id === "tic_tac_toe",
    8000,
    "round one started"
  );
  guest.send(JSON.stringify({ type: "select_game", gameId: "tic_tac_toe" }));

  const roundOneStarted = await roundOneStartedPromise;
  const roundOneHostId = roundOneStarted.room.players.host.id;
  const roundOneGuestId = roundOneStarted.room.players.guest.id;

  expect(roundOneStarted.room.round.firstPlayerId).toBe(roundOneHostId);
  expect(roundOneStarted.room.round.status).toBe("playing");
  expect(roundOneStarted.room.game.state.nextPlayerId).toBe(roundOneHostId);

  const afterHostMoveOne = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 1,
    8000,
    "after host move 1"
  );
  host.send(JSON.stringify({ type: "move", move: { index: 0 } }));
  await afterHostMoveOne;

  const afterGuestMoveOne = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 2,
    8000,
    "after guest move 1"
  );
  guest.send(JSON.stringify({ type: "move", move: { index: 3 } }));
  await afterGuestMoveOne;

  const afterHostMoveTwo = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 3,
    8000,
    "after host move 2"
  );
  host.send(JSON.stringify({ type: "move", move: { index: 1 } }));
  await afterHostMoveTwo;

  const afterGuestMoveTwo = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 4,
    8000,
    "after guest move 2"
  );
  guest.send(JSON.stringify({ type: "move", move: { index: 4 } }));
  await afterGuestMoveTwo;

  const afterHostWinningMove = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.winnerId === roundOneHostId,
    8000,
    "after host winning move"
  );
  host.send(JSON.stringify({ type: "move", move: { index: 2 } }));
  const winningState = await afterHostWinningMove;
  expect(winningState.room.game.state.winningLine).toEqual([0, 1, 2]);

  const roundResetPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && !message.room?.game && message.room?.round?.status === "waiting_game",
    8000,
    "round reset"
  );
  host.send(JSON.stringify({ type: "new_round" }));
  await roundResetPromise;

  host.send(JSON.stringify({ type: "select_game", gameId: "tic_tac_toe" }));
  const roundTwoStartedPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.id === "tic_tac_toe"
      && message.room?.game?.state?.history?.length === 0
      && message.room?.round?.firstPlayerId === roundOneGuestId,
    8000,
    "round two started"
  );
  guest.send(JSON.stringify({ type: "select_game", gameId: "tic_tac_toe" }));

  const roundTwoStarted = await roundTwoStartedPromise;
  expect(roundTwoStarted.room.round.firstPlayerId).toBe(roundOneGuestId);
  expect(roundTwoStarted.room.round.status).toBe("playing");
  expect(roundTwoStarted.room.game.state.nextPlayerId).toBe(roundOneGuestId);

  host.close();
  guest.close();
});
