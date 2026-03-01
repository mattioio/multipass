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

    const state1 = withMockRandom(randomSequenceFromDice([1, 2, 3, 4, 5, 1]), () => {
      return engine.applyMove(state0, { action: "roll" }, "p1").state;
    });
    expect(state1.currentHand.rollsUsedByPlayer.p1).toBe(1);
    expect(state1.nextPlayerId).toBe("p1");

    const state2 = withMockRandom(randomSequenceFromDice([6, 6, 6]), () => {
      return engine.applyMove(state1, { action: "roll", hold: [0, 2] }, "p1").state;
    });
    expect(state2.currentHand.rollsUsedByPlayer.p1).toBe(2);
    expect(state2.currentHand.diceByPlayer.p1.slice(0, 5)).toEqual([1, 6, 3, 6, 6]);
    expect(state2.currentHand.diceByPlayer.p1).toHaveLength(6);

    const state3 = engine.applyMove(state2, { action: "bank" }, "p1").state;
    expect(state3.currentHand.finalByPlayer.p1).toBeTruthy();
    expect(state3.currentHand.finalByPlayer.p1?.bankedPoints).toBeGreaterThanOrEqual(0);
    expect(state3.pointsByPlayer.p1).toBe(state3.currentHand.finalByPlayer.p1?.pointsAfterBank);
    expect(state3.nextPlayerId).toBe("p2");
  });

  it("advances to the next round when both players tie", () => {
    const engine = createPokerDiceEngine();
    const state0 = engine.init(players());

    const sequence = [
      ...randomSequenceFromDice([2, 2, 3, 4, 5, 2]),
      ...randomSequenceFromDice([2, 2, 3, 4, 5, 2])
    ];

    const state1 = withMockRandom(sequence.slice(0, 6), () => {
      return engine.applyMove(state0, { action: "roll" }, "p1").state;
    });
    const state2 = engine.applyMove(state1, { action: "bank" }, "p1").state;

    const state3 = withMockRandom(sequence.slice(6), () => {
      return engine.applyMove(state2, { action: "roll" }, "p2").state;
    });
    const state4 = engine.applyMove(state3, { action: "bank" }, "p2").state;

    expect(state4.handTies).toBe(1);
    expect(state4.currentHandNumber).toBe(2);
    expect(state4.nextPlayerId).toBe("p1");
    expect(state4.currentHand.finalByPlayer.p1).toBeNull();
    expect(state4.currentHand.finalByPlayer.p2).toBeNull();
    const lastResult = state4.history[state4.history.length - 1];
    expect(lastResult?.type).toBe("hand_result");
    expect(lastResult?.winnerId).toBeNull();
  });

  it("finishes after 3 rounds and picks winner by total points", () => {
    const engine = createPokerDiceEngine();
    const state0 = engine.init(players());

    let state = withMockRandom(randomSequenceFromDice([2, 3, 4, 5, 6, 2]), () => {
      return engine.applyMove(state0, { action: "roll" }, "p1").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p1").state;

    state = withMockRandom(randomSequenceFromDice([1, 1, 3, 4, 5, 6]), () => {
      return engine.applyMove(state, { action: "roll" }, "p2").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p2").state;

    expect(state.currentHandNumber).toBe(2);
    expect(state.pointsByPlayer.p1).toBe(16);
    expect(state.pointsByPlayer.p2).toBe(0);
    expect(state.nextPlayerId).toBe("p1");

    state = withMockRandom(randomSequenceFromDice([2, 3, 4, 5, 6, 2]), () => {
      return engine.applyMove(state, { action: "roll" }, "p1").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p1").state;

    state = withMockRandom(randomSequenceFromDice([1, 1, 3, 4, 5, 6]), () => {
      return engine.applyMove(state, { action: "roll" }, "p2").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p2").state;

    expect(state.currentHandNumber).toBe(3);
    expect(state.pointsByPlayer.p1).toBe(32);
    expect(state.pointsByPlayer.p2).toBe(0);
    expect(state.nextPlayerId).toBe("p1");

    state = withMockRandom(randomSequenceFromDice([1, 1, 2, 3, 4, 5]), () => {
      return engine.applyMove(state, { action: "roll" }, "p1").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p1").state;

    state = withMockRandom(randomSequenceFromDice([1, 1, 3, 4, 5, 6]), () => {
      return engine.applyMove(state, { action: "roll" }, "p2").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p2").state;

    expect(state.winnerId).toBe("p1");
    expect(state.phase).toBe("finished");
    expect(state.nextPlayerId).toBeNull();
    expect(state.currentHandNumber).toBe(3);
    expect(state.pointsByPlayer.p1).toBe(52);
    expect(state.pointsByPlayer.p2).toBe(0);
    expect(state.draw).toBeFalsy();
  });

  it("classifies A+K+Q+J+10 as royal flush and K+Q+J+10+9 as flush", () => {
    const engine = createPokerDiceEngine();
    const state0 = engine.init(players());

    let state = withMockRandom(randomSequenceFromDice([1, 2, 3, 4, 5, 1]), () => {
      return engine.applyMove(state0, { action: "roll" }, "p1").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p1").state;
    expect(state.currentHand.finalByPlayer.p1?.category).toBe("royal_flush");
    expect(state.currentHand.finalByPlayer.p1?.bankedPoints).toBe(20);
    expect(state.pointsByPlayer.p1).toBe(20);

    state = withMockRandom(randomSequenceFromDice([2, 3, 4, 5, 6, 2]), () => {
      return engine.applyMove(state, { action: "roll" }, "p2").state;
    });
    state = engine.applyMove(state, { action: "bank" }, "p2").state;
    const lastResult = state.history[state.history.length - 1];
    expect(lastResult?.type).toBe("hand_result");
    expect(lastResult?.right?.category).toBe("flush");
    expect(lastResult?.right?.bankedPoints).toBe(16);
    expect(state.pointsByPlayer.p2).toBe(16);
  });
});
