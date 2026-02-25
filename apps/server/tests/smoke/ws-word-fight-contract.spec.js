import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import WORD_FIGHT_WORDS from "../../src/games/wordFightWords.js";
import { WORD_FIGHT_POINTS } from "../../../shared/src/games/wordFightScoring.js";

const WS_URL = "ws://127.0.0.1:3001";
const FALLBACK_GUESSES = ["ABLE", "BARK", "CAMP", "DOVE", "FIRM", "GLAD", "HUNT", "JUMP", "LAMP", "MINT"];

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

function pickWrongGuess(secret, offset = 0) {
  const normalized = String(secret || "").toUpperCase();
  for (let index = 0; index < FALLBACK_GUESSES.length; index += 1) {
    const guess = FALLBACK_GUESSES[(index + offset) % FALLBACK_GUESSES.length];
    if (guess !== normalized) return guess;
  }
  return "BARK";
}

function pickNoOverlapGuess(secret, used = new Set()) {
  const letters = new Set(String(secret || "").toUpperCase().split(""));
  return WORD_FIGHT_WORDS.find((word) => {
    if (used.has(word)) return false;
    if (word === String(secret || "").toUpperCase()) return false;
    return word.split("").every((char) => !letters.has(char));
  }) || null;
}

async function setupWordFightMatch() {
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

  host.send(JSON.stringify({ type: "select_game", gameId: "word_fight" }));
  const hostStartedPromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.id === "word_fight",
    8000,
    "host word fight started"
  );
  const guestStartedPromise = waitForMessage(
    guest,
    (message) => message.type === "room_state" && message.room?.game?.id === "word_fight",
    8000,
    "guest word fight started"
  );
  guest.send(JSON.stringify({ type: "select_game", gameId: "word_fight" }));

  const hostStarted = await hostStartedPromise;
  const guestStarted = await guestStartedPromise;

  return {
    host,
    guest,
    hostStarted,
    guestStarted
  };
}

test("word fight keeps secrets private per player and resolves winner by scoring", async () => {
  const { host, guest, hostStarted, guestStarted } = await setupWordFightMatch();

  const hostId = hostStarted.room.players.host.id;
  const guestId = hostStarted.room.players.guest.id;
  const hostSecret = hostStarted.room.game.state.mySecretWord;
  const guestSecret = guestStarted.room.game.state.mySecretWord;

  expect(typeof hostSecret).toBe("string");
  expect(typeof guestSecret).toBe("string");
  expect(hostSecret).toHaveLength(4);
  expect(guestSecret).toHaveLength(4);
  expect(hostStarted.room.game.state.wordsByPlayer).toBeUndefined();
  expect(guestStarted.room.game.state.wordsByPlayer).toBeUndefined();

  const afterHostSolve = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 1,
    8000,
    "after host solve"
  );
  host.send(JSON.stringify({ type: "move", gameId: "word_fight", move: { guess: hostSecret } }));
  const solvedUpdate = await afterHostSolve;
  expect(solvedUpdate.room.game.state.progressByPlayer[hostId].score).toBe(60);
  expect(solvedUpdate.room.game.state.progressByPlayer[hostId].scoreBreakdown).toEqual({
    presentPoints: 0,
    exactPoints: 4 * WORD_FIGHT_POINTS.exactByAttempt[0],
    solvePoints: WORD_FIGHT_POINTS.solveByAttempt[0]
  });
  expect(solvedUpdate.room.game.state.history[0]?.pointsEarned).toBe(60);
  expect(solvedUpdate.room.game.state.history[0]?.pointsByType?.solve).toBe(WORD_FIGHT_POINTS.solveByAttempt[0]);
  expect(solvedUpdate.room.game.state.nextPlayerId).toBe(guestId);

  let update = solvedUpdate;
  const noOverlapUsed = new Set();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const expectedLength = 2 + attempt;
    const nextUpdatePromise = waitForMessage(
      host,
      (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === expectedLength,
      8000,
      `guest attempt ${attempt + 1}`
    );
    const noOverlap = pickNoOverlapGuess(guestSecret, noOverlapUsed);
    const guess = noOverlap || pickWrongGuess(guestSecret, attempt);
    noOverlapUsed.add(guess);
    guest.send(JSON.stringify({
      type: "move",
      gameId: "word_fight",
      move: { guess }
    }));
    update = await nextUpdatePromise;
  }

  expect(update.room.game.state.progressByPlayer[guestId].exhausted).toBe(true);
  expect(update.room.game.state.progressByPlayer[guestId].score).toBe(0);
  expect(update.room.game.state.winnerId).toBe(hostId);
  expect(update.room.game.state.draw).toBe(false);

  host.close();
  guest.close();
});

test("word fight accepts standard and repeated-letter dictionary guesses", async () => {
  const { host, guest, hostStarted } = await setupWordFightMatch();
  const hostId = hostStarted.room.players.host.id;
  const guestId = hostStarted.room.players.guest.id;

  const afterHostMove = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 1,
    8000,
    "after host dictionary guess"
  );
  host.send(JSON.stringify({ type: "move", gameId: "word_fight", move: { guess: "RAGS" } }));
  const hostUpdate = await afterHostMove;
  expect(hostUpdate.room.game.state.history[0]?.guess).toBe("RAGS");
  expect(hostUpdate.room.game.state.progressByPlayer[hostId].attemptsUsed).toBe(1);

  const afterGuestMove = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 2,
    8000,
    "after guest dictionary guess"
  );
  guest.send(JSON.stringify({ type: "move", gameId: "word_fight", move: { guess: "GOOD" } }));
  const guestUpdate = await afterGuestMove;
  expect(guestUpdate.room.game.state.history[1]?.guess).toBe("GOOD");
  expect(guestUpdate.room.game.state.progressByPlayer[guestId].attemptsUsed).toBe(1);

  const invalidGuessError = waitForMessage(
    host,
    (message) => message.type === "error" && message.code === "INVALID_PAYLOAD",
    8000,
    "invalid dictionary guess error"
  );
  host.send(JSON.stringify({ type: "move", gameId: "word_fight", move: { guess: "ZZZZ" } }));
  const invalidResponse = await invalidGuessError;
  expect(invalidResponse.message).toContain("valid Word Fight word");

  host.close();
  guest.close();
});

test("word fight is a draw when both players solve on the same attempt", async () => {
  const { host, guest, hostStarted, guestStarted } = await setupWordFightMatch();

  const hostSecret = hostStarted.room.game.state.mySecretWord;
  const guestSecret = guestStarted.room.game.state.mySecretWord;

  const afterHostSolve = waitForMessage(
    host,
    (message) => message.type === "room_state" && message.room?.game?.state?.history?.length === 1,
    8000,
    "after host solve"
  );
  host.send(JSON.stringify({ type: "move", gameId: "word_fight", move: { guess: hostSecret } }));
  await afterHostSolve;

  const finalStatePromise = waitForMessage(
    host,
    (message) => message.type === "room_state" && Boolean(message.room?.game?.state?.draw),
    8000,
    "word fight draw"
  );
  guest.send(JSON.stringify({ type: "move", gameId: "word_fight", move: { guess: guestSecret } }));

  const finalState = await finalStatePromise;
  expect(finalState.room.game.state.winnerId).toBeNull();
  expect(finalState.room.game.state.draw).toBe(true);

  host.close();
  guest.close();
});
