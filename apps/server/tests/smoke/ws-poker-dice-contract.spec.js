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

async function setupPokerDiceMatch() {
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

  host.send(JSON.stringify({ type: "select_game", gameId: "poker_dice" }));
  const startedPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.id === "poker_dice",
    8000,
    "poker dice started"
  );
  guest.send(JSON.stringify({ type: "select_game", gameId: "poker_dice" }));

  const started = await startedPromise;
  return { host, guest, started };
}

test("poker dice enforces move gameId, supports hold+bank flow, and completes best-of-three", async () => {
  const { host, guest, started } = await setupPokerDiceMatch();

  const hostId = started.room.players.host.id;
  const guestId = started.room.players.guest.id;
  expect(started.room.round.firstPlayerId).toBe(hostId);
  expect(started.room.game.state.nextPlayerId).toBe(hostId);

  const mismatchErrorPromise = waitForMessage(
    host,
    (message) => message.type === "error" && message.code === "INVALID_PAYLOAD",
    8000,
    "move game mismatch"
  );
  host.send(JSON.stringify({ type: "move", gameId: "word_fight", move: { action: "roll" } }));
  const mismatchError = await mismatchErrorPromise;
  expect(mismatchError.message).toMatch(/gameId/i);

  const afterHostRollOne = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 1,
    8000,
    "host roll one"
  );
  host.send(JSON.stringify({ type: "move", gameId: "poker_dice", move: { action: "roll", hold: [0, 2] } }));
  let update = await afterHostRollOne;
  expect(update.room.game.state.currentHand.rollsUsedByPlayer[hostId]).toBe(1);
  expect(update.room.game.state.nextPlayerId).toBe(hostId);

  const afterHostRollTwo = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 2,
    8000,
    "host roll two"
  );
  host.send(JSON.stringify({ type: "move", gameId: "poker_dice", move: { action: "roll", hold: [0, 2] } }));
  update = await afterHostRollTwo;
  expect(update.room.game.state.currentHand.rollsUsedByPlayer[hostId]).toBe(2);
  expect(update.room.game.state.currentHand.locksByPlayer[hostId][0]).toBe(true);
  expect(update.room.game.state.currentHand.locksByPlayer[hostId][2]).toBe(true);

  const afterHostBank = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.currentHand?.finalByPlayer?.[hostId],
    8000,
    "host bank"
  );
  host.send(JSON.stringify({ type: "move", gameId: "poker_dice", move: { action: "bank" } }));
  update = await afterHostBank;
  expect(update.room.game.state.nextPlayerId).toBe(guestId);

  let turns = 0;

  while (update.room.game.state.phase !== "finished" && turns < 30) {
    const gameState = update.room.game.state;
    const activePlayerId = gameState.nextPlayerId;
    const activeWs = activePlayerId === hostId ? host : guest;
    const historyLength = gameState.history.length;
    const handNumber = Number(gameState.currentHandNumber || 1);
    const handTies = Number(gameState.handTies || 0);

    const afterRoll = waitForMessage(
      host,
      (message) => {
        const next = message.room?.game?.state;
        if (message.type !== "room_state" || !next) return false;
        const tail = Array.isArray(next.history) && next.history.length ? next.history[next.history.length - 1] : null;
        return next.history.length === historyLength + 1
          && tail?.type === "roll"
          && tail?.playerId === activePlayerId;
      },
      8000,
      `roll ${turns + 1}`
    );
    activeWs.send(JSON.stringify({ type: "move", gameId: "poker_dice", move: { action: "roll" } }));
    await afterRoll;

    const afterBank = waitForMessage(
      host,
      (message) => {
        const next = message.room?.game?.state;
        if (message.type !== "room_state" || !next) return false;
        if (next.phase === "finished") return true;
        if (Number(next.handTies || 0) > handTies) return true;
        if (Number(next.currentHandNumber || 1) !== handNumber) return true;
        return next.nextPlayerId !== activePlayerId;
      },
      8000,
      `bank ${turns + 1}`
    );
    activeWs.send(JSON.stringify({ type: "move", gameId: "poker_dice", move: { action: "bank" } }));
    update = await afterBank;

    const nextState = update.room.game.state;
    if (Number(nextState.handTies || 0) > handTies) {
      expect(Number(nextState.currentHandNumber || 1)).toBe(handNumber + 1);
    }

    turns += 1;
  }

  expect(update.room.game.state.phase).toBe("finished");
  expect(Number(update.room.game.state.currentHandNumber || 1)).toBe(3);
  const winnerId = update.room.game.state.winnerId;
  if (winnerId) {
    const hostPoints = Number(update.room.game.state.pointsByPlayer?.[hostId] || 0);
    const guestPoints = Number(update.room.game.state.pointsByPlayer?.[guestId] || 0);
    expect(hostPoints === guestPoints).toBe(false);
    const expectedWinnerId = hostPoints > guestPoints ? hostId : guestId;
    expect(winnerId).toBe(expectedWinnerId);
  } else {
    expect(update.room.game.state.draw).toBe(true);
  }

  host.close();
  guest.close();
});
