import { createPokerDiceEngine } from "../engines/pokerDiceEngine.js";

function players() {
  return [{ id: "p1" }, { id: "p2" }];
}

function toRandomValue(dieValue) {
  return (Number(dieValue) - 0.5) / 6;
}

function randomSequenceFromDice(diceValues) {
  return diceValues.map((value) => toRandomValue(value));
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

describe("poker dice engine", () => {
  it("enforces roll-then-bank flow and supports holds between rolls", () => {
    const engine = createPokerDiceEngine();
    const state0 = engine.init(players());

    expect(engine.applyMove(state0, { action: "bank" }, "p1")).toEqual({ error: "Roll at least once before banking." });

    const state1 = withMockRandom(randomSequenceFromDice([1, 2, 3, 4, 5]), () => {
      return engine.applyMove(state0, { action: "roll" }, "p1").state;
    });
    expect(state1.currentHand.rollsUsedByPlayer.p1).toBe(1);
    expect(state1.nextPlayerId).toBe("p1");

    const state2 = withMockRandom(randomSequenceFromDice([6, 6, 6]), () => {
      return engine.applyMove(state1, { action: "roll", hold: [0, 2] }, "p1").state;
    });
    expect(state2.currentHand.rollsUsedByPlayer.p1).toBe(2);
    expect(state2.currentHand.diceByPlayer.p1).toEqual([1, 6, 3, 6, 6]);

    const state3 = engine.applyMove(state2, { action: "bank" }, "p1").state;
    expect(state3.currentHand.finalByPlayer.p1).toBeTruthy();
    expect(state3.nextPlayerId).toBe("p2");
  });

  it("replays the same hand when both players tie", () => {
    const engine = createPokerDiceEngine();
    const state0 = engine.init(players());

    const sequence = [
      ...randomSequenceFromDice([2, 2, 3, 4, 5]),
      ...randomSequenceFromDice([2, 2, 3, 4, 5])
    ];

    const state1 = withMockRandom(sequence.slice(0, 5), () => {
      return engine.applyMove(state0, { action: "roll" }, "p1").state;
    });
    const state2 = engine.applyMove(state1, { action: "bank" }, "p1").state;

    const state3 = withMockRandom(sequence.slice(5), () => {
      return engine.applyMove(state2, { action: "roll" }, "p2").state;
    });
    const state4 = engine.applyMove(state3, { action: "bank" }, "p2").state;

    expect(state4.handTies).toBe(1);
    expect(state4.currentHandNumber).toBe(1);
    expect(state4.nextPlayerId).toBe("p1");
    expect(state4.currentHand.finalByPlayer.p1).toBeNull();
    expect(state4.currentHand.finalByPlayer.p2).toBeNull();
  });

  it("finishes the match when a player wins two hands", () => {
    const engine = createPokerDiceEngine();
    const state0 = engine.init(players());

    let state = withMockRandom(randomSequenceFromDice([6, 6, 6, 6, 6]), () => {
      return engine.applyMove(state0, { action: "roll" }, "p1").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p1").state;

    state = withMockRandom(randomSequenceFromDice([1, 2, 3, 4, 6]), () => {
      return engine.applyMove(state, { action: "roll" }, "p2").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p2").state;

    expect(state.handWins.p1).toBe(1);
    expect(state.currentHandNumber).toBe(2);
    expect(state.nextPlayerId).toBe("p2");

    state = withMockRandom(randomSequenceFromDice([1, 2, 3, 4, 5]), () => {
      return engine.applyMove(state, { action: "roll" }, "p2").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p2").state;

    state = withMockRandom(randomSequenceFromDice([5, 5, 5, 5, 2]), () => {
      return engine.applyMove(state, { action: "roll" }, "p1").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p1").state;

    expect(state.winnerId).toBe("p1");
    expect(state.phase).toBe("finished");
    expect(state.nextPlayerId).toBeNull();
    expect(state.handWins.p1).toBe(2);
  });
});
