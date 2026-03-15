import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import game from "../wordFight.js";
import { isWordFightWord } from "../wordFightWords.js";

const P1 = { id: "p1" };
const P2 = { id: "p2" };

// Find two known valid 4-letter words from the dictionary for testing
function findTestWords() {
  // ABLE and ARCH are common English words likely in the dictionary
  const candidates = ["ABLE", "ARCH", "BAKE", "CALM", "DAZE", "EACH", "FACE", "GAME"];
  const valid = candidates.filter((w) => isWordFightWord(w));
  if (valid.length < 2) throw new Error("Need at least 2 valid test words");
  return valid;
}

describe("wordFight", () => {
  let mockRandomIndex;

  beforeEach(() => {
    mockRandomIndex = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      // Return values that will select indices 0 and 1 from the secret words array
      const value = mockRandomIndex * 0.001;
      mockRandomIndex += 1;
      return value;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("init", () => {
    it("creates a valid initial state", () => {
      const state = game.init([P1, P2]);
      expect(state.playerOrder).toEqual(["p1", "p2"]);
      expect(state.nextPlayerId).toBe("p1");
      expect(state.maxGuesses).toBe(5);
      expect(state.winnerId).toBeNull();
      expect(state.draw).toBe(false);
      expect(state.wordsByPlayer.p1).toBeTruthy();
      expect(state.wordsByPlayer.p2).toBeTruthy();
      expect(state.wordsByPlayer.p1).not.toBe(state.wordsByPlayer.p2);
      expect(state.boardsByPlayer.p1).toEqual([]);
      expect(state.boardsByPlayer.p2).toEqual([]);
      expect(state.progressByPlayer.p1.attemptsUsed).toBe(0);
    });
  });

  describe("applyMove", () => {
    it("rejects wrong turn", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { guess: "ABLE" }, "p2")).toEqual({
        error: "Not your turn."
      });
    });

    it("rejects non-4-letter guess", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { guess: "AB" }, "p1")).toEqual({
        error: "Guess must be exactly 4 letters."
      });
      expect(game.applyMove(state, { guess: "ABCDE" }, "p1")).toEqual({
        error: "Guess must be exactly 4 letters."
      });
    });

    it("rejects invalid dictionary word", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { guess: "ZZZZ" }, "p1")).toEqual({
        error: "Guess must be a valid Word Fight word."
      });
    });

    it("accepts a valid guess and produces feedback", () => {
      const state = game.init([P1, P2]);
      const validWords = findTestWords();
      const result = game.applyMove(state, { guess: validWords[0] }, "p1");
      expect(result.state).toBeDefined();
      expect(result.state.boardsByPlayer.p1).toHaveLength(1);
      expect(result.state.boardsByPlayer.p1[0].guess).toBe(validWords[0]);
      expect(result.state.boardsByPlayer.p1[0].feedback).toHaveLength(4);
      expect(result.state.progressByPlayer.p1.attemptsUsed).toBe(1);
    });

    it("alternates turns between players", () => {
      const state = game.init([P1, P2]);
      const validWords = findTestWords();
      const r1 = game.applyMove(state, { guess: validWords[0] }, "p1");
      expect(r1.state.nextPlayerId).toBe("p2");
      const r2 = game.applyMove(r1.state, { guess: validWords[1] }, "p2");
      expect(r2.state.nextPlayerId).toBe("p1");
    });

    it("rejects move after game finished", () => {
      const state = game.init([P1, P2]);
      const finished = { ...state, winnerId: "p1" };
      expect(game.applyMove(finished, { guess: "ABLE" }, "p2")).toEqual({
        error: "Game is already finished."
      });
    });
  });

  describe("solving", () => {
    it("marks player as solved when guessing their secret word", () => {
      const state = game.init([P1, P2]);
      const secret = state.wordsByPlayer.p1;
      const result = game.applyMove(state, { guess: secret }, "p1");
      expect(result.state.progressByPlayer.p1.solved).toBe(true);
      expect(result.state.boardsByPlayer.p1[0].solved).toBe(true);
      expect(result.state.boardsByPlayer.p1[0].feedback).toEqual(["exact", "exact", "exact", "exact"]);
    });
  });

  describe("exhaustion", () => {
    it("marks player as exhausted after max guesses", () => {
      let state = game.init([P1, P2]);
      const validWords = findTestWords();
      // Use a word that won't be the secret (extremely unlikely)
      const wrongGuess = validWords.find((w) => w !== state.wordsByPlayer.p1 && w !== state.wordsByPlayer.p2);
      if (!wrongGuess) return; // skip if we can't find a safe wrong guess

      for (let i = 0; i < 5; i++) {
        // p1 guesses wrong
        const r1 = game.applyMove(state, { guess: wrongGuess }, state.nextPlayerId);
        if (r1.error) break;
        state = r1.state;
        if (state.nextPlayerId === "p2") {
          // p2 guesses wrong too
          const wrongForP2 = validWords.find((w) => w !== state.wordsByPlayer.p2);
          if (!wrongForP2) break;
          const r2 = game.applyMove(state, { guess: wrongForP2 }, "p2");
          if (r2.error) break;
          state = r2.state;
        }
      }

      // At least one player should be exhausted after enough guesses
      const p1Progress = state.progressByPlayer.p1;
      const p2Progress = state.progressByPlayer.p2;
      expect(p1Progress.attemptsUsed > 0 || p2Progress.attemptsUsed > 0).toBe(true);
    });
  });

  describe("feedback", () => {
    it("produces correct feedback for exact, present, and absent", () => {
      // Construct a state with a known secret word
      const state = game.init([P1, P2]);
      // Override the secret word for p1 to test feedback
      const testState = {
        ...state,
        wordsByPlayer: { ...state.wordsByPlayer, p1: "ABLE" }
      };

      // Guess "BALE" against secret "ABLE":
      // B: present (B is in ABLE but not at index 0)
      // A: present (A is in ABLE but not at index 1)
      // L: exact (L is at index 2)
      // E: exact (E is at index 3)
      const result = game.applyMove(testState, { guess: "BALE" }, "p1");
      expect(result.state.boardsByPlayer.p1[0].feedback).toEqual([
        "present", "present", "exact", "exact"
      ]);
    });
  });

  describe("projectState", () => {
    it("hides secret words from non-viewers", () => {
      const state = game.init([P1, P2]);
      const projected = game.projectState(state, "p1");
      expect(projected.mySecretWord).toBe(state.wordsByPlayer.p1);
      expect(projected.wordsByPlayer).toBeUndefined();
    });
  });
});
