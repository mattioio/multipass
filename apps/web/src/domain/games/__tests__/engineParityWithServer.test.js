import { describe, expect, it, vi } from "vitest";
import serverTicTacToe from "../../../../../server/src/games/ticTacToe.js";
import serverDotsAndBoxes from "../../../../../server/src/games/dotsAndBoxes.js";
import serverWordFight from "../../../../../server/src/games/wordFight.js";
import serverPokerDice from "../../../../../server/src/games/pokerDice.js";
import { gameCatalog } from "../catalog.js";
import { createDotsAndBoxesEngine } from "../engines/dotsAndBoxesEngine.js";
import { createWordFightEngine } from "../engines/wordFightEngine.js";
import { createPokerDiceEngine } from "../engines/pokerDiceEngine.js";
import { WORD_FIGHT_SECRET_WORD_TO_CATEGORY } from "../engines/wordFightWords.js";

function players() {
  return [{ id: "p1" }, { id: "p2" }];
}

function withMockRandom(sequence, run) {
  const original = Math.random;
  let index = 0;
  Math.random = () => {
    const next = sequence[index] ?? sequence[sequence.length - 1] ?? 0;
    index += 1;
    return next;
  };
  try {
    return run();
  } finally {
    Math.random = original;
  }
}

function runScript(engine, script, setup) {
  let state = engine.init(players());
  if (typeof setup === "function") {
    state = setup(state);
  }

  for (const step of script) {
    const move = typeof step.move === "function" ? step.move(state) : step.move;
    const playerId = typeof step.playerId === "function"
      ? step.playerId(state)
      : (step.playerId || state.nextPlayerId);

    const result = engine.applyMove(state, move, playerId);
    expect(result?.error).toBeUndefined();
    state = result.state;
  }

  return state;
}

function normalizeForComparison(state) {
  const clone = JSON.parse(JSON.stringify(state));
  if (clone && typeof clone === "object" && "turnStartedAt" in clone) {
    clone.turnStartedAt = 0;
  }
  return clone;
}

describe("web local engines stay in parity with server engines", () => {
  it("keeps tic-tac-toe move progression in parity", () => {
    const script = [
      { move: { index: 0 } },
      { move: { index: 3 } },
      { move: { index: 1 } },
      { move: { index: 4 } },
      { move: { index: 2 } }
    ];

    const webState = runScript(gameCatalog.tic_tac_toe.localEngine, script);
    const serverState = runScript(serverTicTacToe, script);
    expect(normalizeForComparison(webState)).toEqual(normalizeForComparison(serverState));
  });

  it("keeps dots-and-boxes move progression in parity", () => {
    const script = [
      { move: { edgeIndex: 0 } },
      { move: { edgeIndex: 1 } },
      { move: { edgeIndex: 2 } },
      { move: { edgeIndex: 3 } },
      { move: { edgeIndex: 4 } },
      { move: { edgeIndex: 5 } }
    ];

    const webState = runScript(createDotsAndBoxesEngine(), script);
    const serverState = runScript(serverDotsAndBoxes, script);
    expect(normalizeForComparison(webState)).toEqual(normalizeForComparison(serverState));
  });

  it("keeps word-fight turn progression in parity", () => {
    const randomSequence = [0, 0.21];
    const script = [
      { move: { guess: "COME" } },
      { move: { guess: "BARK" } },
      { move: { guess: "TIME" } }
    ];
    const setup = (initialState) => ({
      ...initialState,
      wordsByPlayer: {
        ...initialState.wordsByPlayer,
        p1: "TIME",
        p2: "WORM"
      },
      categoryByPlayer: {
        ...initialState.categoryByPlayer,
        p1: WORD_FIGHT_SECRET_WORD_TO_CATEGORY.TIME,
        p2: WORD_FIGHT_SECRET_WORD_TO_CATEGORY.WORM
      },
      nextPlayerId: "p1",
      turnStartedAt: Date.now()
    });

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    try {
      const webState = withMockRandom(randomSequence, () => runScript(createWordFightEngine(), script, setup));
      const serverState = withMockRandom(randomSequence, () => runScript(serverWordFight, script, setup));
      expect(normalizeForComparison(webState)).toEqual(normalizeForComparison(serverState));
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("keeps poker-dice hand starter + turn progression in parity", () => {
    const randomSequence = [
      0.02, 0.12, 0.22, 0.32, 0.42, 0.52,
      0.62, 0.72, 0.82, 0.92, 0.15, 0.25
    ];
    const script = [
      { move: { action: "roll" }, playerId: (state) => state.nextPlayerId },
      { move: { action: "bank" }, playerId: (state) => state.nextPlayerId },
      { move: { action: "roll" }, playerId: (state) => state.nextPlayerId },
      { move: { action: "bank" }, playerId: (state) => state.nextPlayerId }
    ];

    const webState = withMockRandom(randomSequence, () => runScript(createPokerDiceEngine(), script));
    const serverState = withMockRandom(randomSequence, () => runScript(serverPokerDice, script));
    expect(normalizeForComparison(webState)).toEqual(normalizeForComparison(serverState));
    expect(webState.currentHandNumber).toBe(2);
    expect(webState.handStarterId).toBe("p2");
    expect(webState.nextPlayerId).toBe("p2");
  });
});
