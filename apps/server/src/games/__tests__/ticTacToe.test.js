import { describe, it, expect } from "vitest";
import game from "../ticTacToe.js";

const P1 = { id: "p1" };
const P2 = { id: "p2" };

function play(moves) {
  let state = game.init([P1, P2]);
  for (const [playerId, index] of moves) {
    const result = game.applyMove(state, { index }, playerId);
    if (result.error) return result;
    state = result.state;
  }
  return { state };
}

describe("ticTacToe", () => {
  describe("init", () => {
    it("creates a valid initial state", () => {
      const state = game.init([P1, P2]);
      expect(state.board).toHaveLength(9);
      expect(state.board.every((c) => c === null)).toBe(true);
      expect(state.playerOrder).toEqual(["p1", "p2"]);
      expect(state.symbols).toEqual({ p1: "X", p2: "O" });
      expect(state.nextPlayerId).toBe("p1");
      expect(state.winnerId).toBeNull();
      expect(state.draw).toBe(false);
      expect(state.history).toEqual([]);
    });
  });

  describe("applyMove", () => {
    it("places a symbol on a valid move", () => {
      const state = game.init([P1, P2]);
      const result = game.applyMove(state, { index: 4 }, "p1");
      expect(result.state.board[4]).toBe("X");
      expect(result.state.nextPlayerId).toBe("p2");
      expect(result.state.history).toHaveLength(1);
    });

    it("rejects wrong turn", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { index: 0 }, "p2")).toEqual({
        error: "Not your turn."
      });
    });

    it("rejects occupied cell", () => {
      const { state } = play([["p1", 0]]);
      expect(game.applyMove(state, { index: 0 }, "p2")).toEqual({
        error: "That space is already taken."
      });
    });

    it("rejects out-of-range index", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { index: 9 }, "p1")).toEqual({
        error: "Invalid move."
      });
      expect(game.applyMove(state, { index: -1 }, "p1")).toEqual({
        error: "Invalid move."
      });
    });

    it("rejects moves after game is finished", () => {
      // p1 wins on top row
      const { state } = play([
        ["p1", 0], ["p2", 3],
        ["p1", 1], ["p2", 4],
        ["p1", 2]
      ]);
      expect(state.winnerId).toBe("p1");
      expect(game.applyMove(state, { index: 5 }, "p2")).toEqual({
        error: "Game is already finished."
      });
    });
  });

  describe("win detection", () => {
    it("detects a row win", () => {
      const { state } = play([
        ["p1", 0], ["p2", 3],
        ["p1", 1], ["p2", 4],
        ["p1", 2]
      ]);
      expect(state.winnerId).toBe("p1");
      expect(state.winningLine).toEqual([0, 1, 2]);
      expect(state.nextPlayerId).toBeNull();
    });

    it("detects a column win", () => {
      const { state } = play([
        ["p1", 0], ["p2", 1],
        ["p1", 3], ["p2", 4],
        ["p1", 6]
      ]);
      expect(state.winnerId).toBe("p1");
      expect(state.winningLine).toEqual([0, 3, 6]);
    });

    it("detects a diagonal win", () => {
      const { state } = play([
        ["p1", 0], ["p2", 1],
        ["p1", 4], ["p2", 2],
        ["p1", 8]
      ]);
      expect(state.winnerId).toBe("p1");
      expect(state.winningLine).toEqual([0, 4, 8]);
    });

    it("detects p2 win", () => {
      const { state } = play([
        ["p1", 0], ["p2", 3],
        ["p1", 1], ["p2", 4],
        ["p1", 8], ["p2", 5]
      ]);
      expect(state.winnerId).toBe("p2");
      expect(state.winningLine).toEqual([3, 4, 5]);
    });
  });

  describe("draw detection", () => {
    it("detects a draw", () => {
      // X O X
      // X X O
      // O X O
      const { state } = play([
        ["p1", 0], ["p2", 1],
        ["p1", 2], ["p2", 5],
        ["p1", 3], ["p2", 6],
        ["p1", 4], ["p2", 8],
        ["p1", 7]
      ]);
      expect(state.draw).toBe(true);
      expect(state.winnerId).toBeNull();
      expect(state.nextPlayerId).toBeNull();
    });
  });
});
