import { createDotsAndBoxesEngine } from "../engines/dotsAndBoxesEngine.js";

function players() {
  return [{ id: "p1" }, { id: "p2" }];
}

describe("dots and boxes engine", () => {
  it("initializes 6x6 dots state with 60 edges and 25 boxes", () => {
    const engine = createDotsAndBoxesEngine();
    const state = engine.init(players());

    expect(state.dotCount).toBe(6);
    expect(state.edges).toHaveLength(60);
    expect(state.boxes).toHaveLength(25);
    expect(state.playerOrder).toEqual(["p1", "p2"]);
    expect(state.nextPlayerId).toBe("p1");
    expect(state.scores).toEqual({ p1: 0, p2: 0 });
  });

  it("rejects invalid, out-of-turn, and duplicate edge moves", () => {
    const engine = createDotsAndBoxesEngine();
    const state0 = engine.init(players());

    expect(engine.applyMove(state0, { edgeIndex: -1 }, "p1")).toEqual({ error: "Invalid move." });
    expect(engine.applyMove(state0, { edgeIndex: 0 }, "p2")).toEqual({ error: "Not your turn." });

    const state1 = engine.applyMove(state0, { edgeIndex: 0 }, "p1").state;
    expect(engine.applyMove(state1, { edgeIndex: 0 }, "p2")).toEqual({ error: "That edge is already taken." });
  });

  it("alternates turns on non-scoring moves", () => {
    const engine = createDotsAndBoxesEngine();
    const state0 = engine.init(players());
    const state1 = engine.applyMove(state0, { edgeIndex: 0 }, "p1").state;

    expect(state1.nextPlayerId).toBe("p2");
    expect(state1.scores).toEqual({ p1: 0, p2: 0 });
    expect(state1.history.at(-1)).toEqual({
      playerId: "p1",
      edgeIndex: 0,
      completedBoxIndices: []
    });
  });

  it("keeps turn and increments score when a move completes a box", () => {
    const engine = createDotsAndBoxesEngine();
    const state0 = engine.init(players());
    const state1 = engine.applyMove(state0, { edgeIndex: 0 }, "p1").state;
    const state2 = engine.applyMove(state1, { edgeIndex: 10 }, "p2").state;
    const state3 = engine.applyMove(state2, { edgeIndex: 30 }, "p1").state;
    const state4 = engine.applyMove(state3, { edgeIndex: 11 }, "p2").state;
    const state5 = engine.applyMove(state4, { edgeIndex: 5 }, "p1").state;
    const state6 = engine.applyMove(state5, { edgeIndex: 12 }, "p2").state;
    const state7 = engine.applyMove(state6, { edgeIndex: 31 }, "p1").state;

    expect(state7.boxes[0]).toBe("p1");
    expect(state7.scores.p1).toBe(1);
    expect(state7.scores.p2).toBe(0);
    expect(state7.nextPlayerId).toBe("p1");
    expect(state7.history.at(-1)).toEqual({
      playerId: "p1",
      edgeIndex: 31,
      completedBoxIndices: [0]
    });
  });

  it("resolves winner or draw when board is fully claimed", () => {
    const engine = createDotsAndBoxesEngine();
    let state = engine.init(players());
    let turns = 0;

    while (!state.winnerId && !state.draw) {
      const edgeIndex = state.edges.findIndex((ownerId) => ownerId === null);
      expect(edgeIndex).toBeGreaterThanOrEqual(0);
      const result = engine.applyMove(state, { edgeIndex }, state.nextPlayerId);
      expect(result?.error).toBeUndefined();
      state = result.state;
      turns += 1;
      expect(turns).toBeLessThanOrEqual(80);
    }

    expect(state.edges.every((ownerId) => ownerId !== null)).toBe(true);
    expect(state.boxes.every((ownerId) => ownerId !== null)).toBe(true);
    expect(Number(state.scores.p1 || 0) + Number(state.scores.p2 || 0)).toBe(25);
    expect(state.nextPlayerId).toBeNull();
    expect(Boolean(state.winnerId) || state.draw).toBe(true);
  });
});
