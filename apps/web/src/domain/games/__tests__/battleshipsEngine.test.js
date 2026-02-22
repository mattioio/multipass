import { createBattleshipsEngine } from "../engines/battleshipsEngine.js";

function players() {
  return [{ id: "p1" }, { id: "p2" }];
}

function setupBattleState() {
  const engine = createBattleshipsEngine();
  const state0 = engine.init(players());
  const state1 = engine.applyMove(state0, { action: "place_ship", index: 0, orientation: "h" }, "p1").state;
  const state2 = engine.applyMove(state1, { action: "place_ship", index: 12, orientation: "h" }, "p2").state;
  const state3 = engine.applyMove(state2, { action: "place_ship", index: 6, orientation: "h" }, "p1").state;
  return {
    engine,
    state: engine.applyMove(state3, { action: "place_ship", index: 18, orientation: "h" }, "p2").state
  };
}

describe("battleships engine", () => {
  it("enforces turn order", () => {
    const engine = createBattleshipsEngine();
    const state = engine.init(players());
    const result = engine.applyMove(state, { action: "place_ship", index: 0, orientation: "h" }, "p2");
    expect(result).toEqual({ error: "Not your turn." });
  });

  it("rejects out-of-bounds, overlap, and invalid orientation placement", () => {
    const engine = createBattleshipsEngine();
    const state0 = engine.init(players());
    const state1 = engine.applyMove(state0, { action: "place_ship", index: 0, orientation: "h" }, "p1").state;

    const outOfBounds = engine.applyMove(state1, { action: "place_ship", index: 35, orientation: "h" }, "p2");
    expect(outOfBounds).toEqual({ error: "Ship goes out of bounds." });

    const invalidOrientation = engine.applyMove(state1, { action: "place_ship", index: 18, orientation: "d" }, "p2");
    expect(invalidOrientation).toEqual({ error: "Invalid ship orientation." });

    const state2 = engine.applyMove(state1, { action: "place_ship", index: 12, orientation: "h" }, "p2").state;
    const overlap = engine.applyMove(state2, { action: "place_ship", index: 1, orientation: "v" }, "p1");
    expect(overlap).toEqual({ error: "Ships cannot overlap." });
  });

  it("tracks hit and miss shots", () => {
    const { engine, state } = setupBattleState();
    expect(state.phase).toBe("battle");
    expect(state.nextPlayerId).toBe("p1");

    const hitState = engine.applyMove(state, { action: "fire", index: 12 }, "p1").state;
    expect(hitState.shotHistory.at(-1)).toEqual({
      attackerId: "p1",
      defenderId: "p2",
      index: 12,
      result: "hit"
    });

    const missState = engine.applyMove(hitState, { action: "fire", index: 35 }, "p2").state;
    expect(missState.shotHistory.at(-1)).toEqual({
      attackerId: "p2",
      defenderId: "p1",
      index: 35,
      result: "miss"
    });
  });

  it("declares a winner when all opponent ship cells are hit", () => {
    const { engine, state } = setupBattleState();
    const s1 = engine.applyMove(state, { action: "fire", index: 12 }, "p1").state;
    const s2 = engine.applyMove(s1, { action: "fire", index: 0 }, "p2").state;
    const s3 = engine.applyMove(s2, { action: "fire", index: 13 }, "p1").state;
    const s4 = engine.applyMove(s3, { action: "fire", index: 5 }, "p2").state;
    const s5 = engine.applyMove(s4, { action: "fire", index: 18 }, "p1").state;
    const s6 = engine.applyMove(s5, { action: "fire", index: 6 }, "p2").state;
    const s7 = engine.applyMove(s6, { action: "fire", index: 19 }, "p1").state;

    expect(s7.phase).toBe("finished");
    expect(s7.winnerId).toBe("p1");
    expect(s7.nextPlayerId).toBeNull();
  });

  it("projects visible state without leaking opponent ship placement", () => {
    const { engine, state } = setupBattleState();
    const visible = engine.getVisibleState(state, "p1");

    expect(visible).not.toHaveProperty("placements");
    expect(visible.board.ships).toEqual([
      { id: "ship_p1_1", cells: [0, 1] },
      { id: "ship_p1_2", cells: [6, 7] }
    ]);
    expect(visible.board.outgoingHits).toEqual([]);
    expect(visible.board.outgoingMisses).toEqual([]);
    expect(visible.board.incomingHits).toEqual([]);
    expect(visible.board.incomingMisses).toEqual([]);
  });

  it("maps incoming and outgoing markers to the unified board projection", () => {
    const { engine, state } = setupBattleState();
    const s1 = engine.applyMove(state, { action: "fire", index: 12 }, "p1").state;
    const s2 = engine.applyMove(s1, { action: "fire", index: 0 }, "p2").state;
    const visible = engine.getVisibleState(s2, "p1");

    expect(visible.board.outgoingHits).toEqual([12]);
    expect(visible.board.outgoingMisses).toEqual([]);
    expect(visible.board.incomingHits).toEqual([0]);
    expect(visible.board.incomingMisses).toEqual([]);
  });
});
