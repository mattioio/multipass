import { gameCatalog } from "../catalog.js";

function players() {
  return [{ id: "p1" }, { id: "p2" }];
}

describe("tic tac toe engine", () => {
  it("sets winningLine when a player wins", () => {
    const engine = gameCatalog.tic_tac_toe.localEngine;
    const state0 = engine.init(players());
    const state1 = engine.applyMove(state0, { index: 0 }, "p1").state;
    const state2 = engine.applyMove(state1, { index: 3 }, "p2").state;
    const state3 = engine.applyMove(state2, { index: 1 }, "p1").state;
    const state4 = engine.applyMove(state3, { index: 4 }, "p2").state;
    const state5 = engine.applyMove(state4, { index: 2 }, "p1").state;

    expect(state5.winnerId).toBe("p1");
    expect(state5.winningLine).toEqual([0, 1, 2]);
    expect(state5.nextPlayerId).toBeNull();
  });

  it("keeps winningLine null when no winner exists", () => {
    const engine = gameCatalog.tic_tac_toe.localEngine;
    const state0 = engine.init(players());
    const state1 = engine.applyMove(state0, { index: 0 }, "p1").state;
    expect(state1.winningLine).toBeNull();

    const state2 = engine.applyMove(state1, { index: 1 }, "p2").state;
    const state3 = engine.applyMove(state2, { index: 2 }, "p1").state;
    const state4 = engine.applyMove(state3, { index: 4 }, "p2").state;
    const state5 = engine.applyMove(state4, { index: 3 }, "p1").state;
    const state6 = engine.applyMove(state5, { index: 5 }, "p2").state;
    const state7 = engine.applyMove(state6, { index: 7 }, "p1").state;
    const state8 = engine.applyMove(state7, { index: 6 }, "p2").state;
    const state9 = engine.applyMove(state8, { index: 8 }, "p1").state;

    expect(state9.draw).toBe(true);
    expect(state9.winnerId).toBeNull();
    expect(state9.winningLine).toBeNull();
  });
});
