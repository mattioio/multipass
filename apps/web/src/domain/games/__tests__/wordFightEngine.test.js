import { createWordFightEngine } from "../engines/wordFightEngine.js";
import {
  WORD_FIGHT_SECRET_WORDS,
  WORD_FIGHT_SECRET_WORD_TO_CATEGORY,
  WORD_FIGHT_WORDS,
  isWordFightWord
} from "../engines/wordFightWords.js";

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

function randomForIndex(index) {
  const size = Math.max(WORD_FIGHT_SECRET_WORDS.length, 1);
  return (index + 0.01) / size;
}

describe("word fight engine", () => {
  it("accumulates exact/present points and stacks solve bonus", () => {
    const engine = createWordFightEngine();
    const state0 = withMockRandom([0, randomForIndex(1)], () => engine.init(players()));
    const base = {
      ...state0,
      wordsByPlayer: { ...state0.wordsByPlayer, p1: "TIME", p2: "WORM" },
      nextPlayerId: "p1"
    };

    const state1 = engine.applyMove(base, { guess: "COME" }, "p1").state;
    expect(state1.progressByPlayer.p1.score).toBe(20);
    expect(state1.progressByPlayer.p1.scoreBreakdown).toEqual({
      presentPoints: 0,
      exactPoints: 20,
      solvePoints: 0
    });
    expect(state1.history[0].pointsEarned).toBe(20);
    expect(state1.history[0].pointsByType).toEqual({
      present: 0,
      exact: 20,
      solve: 0
    });
    expect(state1.nextPlayerId).toBe("p2");

    const state2 = engine.applyMove(state1, { guess: "BARK" }, "p2").state;
    const state3 = engine.applyMove(state2, { guess: "TIME" }, "p1").state;

    expect(state3.progressByPlayer.p1.solved).toBe(true);
    expect(state3.progressByPlayer.p1.score).toBe(68);
    expect(state3.progressByPlayer.p1.scoreBreakdown).toEqual({
      presentPoints: 0,
      exactPoints: 52,
      solvePoints: 16
    });
    expect(state3.history[2].pointsEarned).toBe(48);
    expect(state3.history[2].pointsByType).toEqual({
      present: 0,
      exact: 32,
      solve: 16
    });
  });

  it("awards repeated-letter discovery points on each guess row", () => {
    const engine = createWordFightEngine();
    const state0 = withMockRandom([0, randomForIndex(1)], () => engine.init(players()));
    const base = {
      ...state0,
      wordsByPlayer: { ...state0.wordsByPlayer, p1: "TIME", p2: "WORM" },
      nextPlayerId: "p1"
    };

    const state1 = engine.applyMove(base, { guess: "MORG" }, "p1").state;
    expect(state1.history[0].pointsByType.present).toBe(5);
    expect(state1.progressByPlayer.p1.score).toBe(5);

    const state2 = engine.applyMove(state1, { guess: "BARK" }, "p2").state;
    const state3 = engine.applyMove(state2, { guess: "MORG" }, "p1").state;

    expect(state3.history[2].pointsByType.present).toBe(4);
    expect(state3.progressByPlayer.p1.score).toBe(9);
  });

  it("declares draw on equal scores even with different exact/present totals", () => {
    const engine = createWordFightEngine();
    const state = {
      playerOrder: ["p1", "p2"],
      maxGuesses: 5,
      nextPlayerId: "p2",
      winnerId: null,
      draw: false,
      wordsByPlayer: { p1: "TIME", p2: "TIME" },
      boardsByPlayer: { p1: [], p2: [] },
      progressByPlayer: {
        p1: {
          solved: false,
          exhausted: true,
          attemptsUsed: 5,
          solveAttempt: null,
          score: 50,
          scoreBreakdown: { presentPoints: 0, exactPoints: 50, solvePoints: 0 },
          totalExact: 10,
          totalPresent: 0
        },
        p2: {
          solved: false,
          exhausted: false,
          attemptsUsed: 4,
          solveAttempt: null,
          score: 50,
          scoreBreakdown: { presentPoints: 50, exactPoints: 0, solvePoints: 0 },
          totalExact: 0,
          totalPresent: 10
        }
      },
      history: []
    };

    const result = engine.applyMove(state, { guess: "GOLF" }, "p2");
    expect(result.state.winnerId).toBeNull();
    expect(result.state.draw).toBe(true);
  });

  it("projects only the viewer secret for hidden pass mode", () => {
    const engine = createWordFightEngine();
    const state0 = withMockRandom([0, randomForIndex(1)], () => engine.init(players()));
    const p1Secret = state0.wordsByPlayer.p1;
    const p2Secret = state0.wordsByPlayer.p2;

    const p1Visible = engine.getVisibleState(state0, "p1");
    const p2Visible = engine.getVisibleState(state0, "p2");

    expect(p1Visible.mySecretWord).toBe(p1Secret);
    expect(p2Visible.mySecretWord).toBe(p2Secret);
    expect(p1Visible.mySecretCategory).toBe(WORD_FIGHT_SECRET_WORD_TO_CATEGORY[p1Secret]);
    expect(p2Visible.mySecretCategory).toBe(WORD_FIGHT_SECRET_WORD_TO_CATEGORY[p2Secret]);
    expect(p1Visible.activeHintCategory).toBe(WORD_FIGHT_SECRET_WORD_TO_CATEGORY[p1Secret]);
    expect(p2Visible.activeHintCategory).toBe(WORD_FIGHT_SECRET_WORD_TO_CATEGORY[p1Secret]);
    expect(p1Visible.wordsByPlayer).toBeUndefined();
    expect(p2Visible.wordsByPlayer).toBeUndefined();
    expect(p1Visible.categoryByPlayer).toBeUndefined();
    expect(p2Visible.categoryByPlayer).toBeUndefined();
  });

  it("accepts UK+US dictionary words including repeated-letter entries", () => {
    expect(isWordFightWord("TIME")).toBe(true);
    expect(isWordFightWord("GOOD")).toBe(true);
    expect(isWordFightWord("SEEN")).toBe(true);
    expect(isWordFightWord("RAGS")).toBe(true);
    expect(isWordFightWord("fart")).toBe(true);
    expect(isWordFightWord("WORM")).toBe(true);
    expect(isWordFightWord("1234")).toBe(false);
    expect(isWordFightWord("TOO")).toBe(false);
    expect(isWordFightWord("TOOLS")).toBe(false);
    expect(isWordFightWord("ZZZZ")).toBe(false);
  });

  it("picks secrets from the secret-word pool", () => {
    const engine = createWordFightEngine();
    const state0 = withMockRandom([0, randomForIndex(1)], () => engine.init(players()));
    expect(WORD_FIGHT_SECRET_WORDS.includes(state0.wordsByPlayer.p1)).toBe(true);
    expect(WORD_FIGHT_SECRET_WORDS.includes(state0.wordsByPlayer.p2)).toBe(true);
    expect(WORD_FIGHT_WORDS.includes(state0.wordsByPlayer.p1)).toBe(true);
    expect(WORD_FIGHT_WORDS.includes(state0.wordsByPlayer.p2)).toBe(true);
    expect(state0.categoryByPlayer.p1).toBe(WORD_FIGHT_SECRET_WORD_TO_CATEGORY[state0.wordsByPlayer.p1]);
    expect(state0.categoryByPlayer.p2).toBe(WORD_FIGHT_SECRET_WORD_TO_CATEGORY[state0.wordsByPlayer.p2]);
  });

  it("updates active hint category when turn changes", () => {
    const engine = createWordFightEngine();
    const state0 = withMockRandom([0, randomForIndex(1)], () => engine.init(players()));
    const p2Category = WORD_FIGHT_SECRET_WORD_TO_CATEGORY[state0.wordsByPlayer.p2];
    const state1 = engine.applyMove(state0, { guess: "COME" }, "p1").state;
    const visible = engine.getVisibleState(state1, "p1");
    expect(visible.activeHintCategory).toBe(p2Category);
  });
});
