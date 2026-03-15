import { describe, it, expect } from "vitest";
import game from "../dotsAndBoxes.js";

const P1 = { id: "p1" };
const P2 = { id: "p2" };

// 6x6 dot grid: 30 horizontal edges + 30 vertical edges = 60 total
// Horizontal edges: indices 0-29, Vertical edges: indices 30-59
// Box (row, col) has edges: top-H, bottom-H, left-V, right-V

describe("dotsAndBoxes", () => {
  describe("init", () => {
    it("creates a valid initial state", () => {
      const state = game.init([P1, P2]);
      expect(state.dotCount).toBe(6);
      expect(state.edges).toHaveLength(60);
      expect(state.boxes).toHaveLength(25);
      expect(state.playerOrder).toEqual(["p1", "p2"]);
      expect(state.nextPlayerId).toBe("p1");
      expect(state.scores).toEqual({ p1: 0, p2: 0 });
      expect(state.winnerId).toBeNull();
      expect(state.draw).toBe(false);
    });
  });

  describe("applyMove", () => {
    it("claims an edge on valid move", () => {
      const state = game.init([P1, P2]);
      const result = game.applyMove(state, { edgeIndex: 0 }, "p1");
      expect(result.state.edges[0]).toBe("p1");
      expect(result.state.nextPlayerId).toBe("p2");
    });

    it("rejects wrong turn", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { edgeIndex: 0 }, "p2")).toEqual({
        error: "Not your turn."
      });
    });

    it("rejects already-taken edge", () => {
      const state = game.init([P1, P2]);
      const { state: s1 } = game.applyMove(state, { edgeIndex: 0 }, "p1");
      expect(game.applyMove(s1, { edgeIndex: 0 }, "p2")).toEqual({
        error: "That edge is already taken."
      });
    });

    it("rejects out-of-range edge", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { edgeIndex: 60 }, "p1")).toEqual({
        error: "Invalid move."
      });
      expect(game.applyMove(state, { edgeIndex: -1 }, "p1")).toEqual({
        error: "Invalid move."
      });
    });

    it("rejects unknown player", () => {
      const state = game.init([P1, P2]);
      expect(game.applyMove(state, { edgeIndex: 0 }, "p3")).toEqual({
        error: "Unknown player."
      });
    });
  });

  describe("box completion", () => {
    it("gives extra turn when completing a box", () => {
      // Complete the top-left box (0,0)
      // Edges: top-H(0,0)=0, bottom-H(1,0)=5, left-V(0,0)=30, right-V(0,1)=31
      let state = game.init([P1, P2]);
      // p1 claims top edge
      state = game.applyMove(state, { edgeIndex: 0 }, "p1").state;
      // p2 claims bottom edge
      state = game.applyMove(state, { edgeIndex: 5 }, "p2").state;
      // p1 claims left edge
      state = game.applyMove(state, { edgeIndex: 30 }, "p1").state;
      // p2 claims right edge (completes the box)
      const result = game.applyMove(state, { edgeIndex: 31 }, "p2");
      expect(result.state.boxes[0]).toBe("p2");
      expect(result.state.scores.p2).toBe(1);
      // p2 gets another turn
      expect(result.state.nextPlayerId).toBe("p2");
    });
  });

  describe("game completion", () => {
    it("determines winner by score when all boxes claimed", () => {
      // Fill all edges to force game end
      let state = game.init([P1, P2]);
      let currentPlayer = "p1";

      for (let i = 0; i < 60; i++) {
        if (state.winnerId || state.draw) break;
        if (state.edges[i] !== null) continue;

        const result = game.applyMove(state, { edgeIndex: i }, state.nextPlayerId);
        if (result.error) continue;
        state = result.state;
      }

      // Game should be finished
      expect(state.winnerId !== null || state.draw).toBe(true);
    });
  });
});
