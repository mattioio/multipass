const DICE_PER_HAND = 6;
const MAX_ROLLS_PER_PLAYER = 3;
const MAX_HANDS = 3;

const HAND_RANK = Object.freeze({
  high_card: 0,
  one_pair: 1,
  two_pair: 2,
  three_kind: 4,
  full_house: 8,
  four_kind: 10,
  five_kind: 12,
  flush: 16,
  royal_flush: 20
});

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function buildPlayerMap(playerOrder, factory) {
  return Object.fromEntries(playerOrder.map((id) => [id, factory(id)]));
}

function createEmptyDice() {
  return Array(DICE_PER_HAND).fill(null);
}

function createLockArray() {
  return Array(DICE_PER_HAND).fill(false);
}

function createHandState(playerOrder) {
  return {
    rollsUsedByPlayer: buildPlayerMap(playerOrder, () => 0),
    diceByPlayer: buildPlayerMap(playerOrder, () => createEmptyDice()),
    locksByPlayer: buildPlayerMap(playerOrder, () => createLockArray()),
    finalByPlayer: buildPlayerMap(playerOrder, () => null)
  };
}

function getOtherPlayerId(state, playerId) {
  return state.playerOrder.find((id) => id !== playerId) || null;
}

function normalizeHoldIndices(rawHold) {
  if (!Array.isArray(rawHold)) return [];
  const unique = new Set();
  for (const value of rawHold) {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= DICE_PER_HAND) continue;
    unique.add(index);
  }
  return [...unique].sort((a, b) => a - b);
}

function compareNumberArrays(a = [], b = []) {
  const max = Math.max(a.length, b.length);
  for (let index = 0; index < max; index += 1) {
    const left = Number(a[index] || 0);
    const right = Number(b[index] || 0);
    if (left === right) continue;
    return left > right ? 1 : -1;
  }
  return 0;
}

function classifyHand(dice) {
  const values = [...dice].sort((a, b) => b - a);
  const counts = new Map();
  for (const value of dice) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  const entries = [...counts.entries()]
    .map(([value, count]) => ({ value: Number(value), count: Number(count) }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return b.value - a.value;
    });

  const countPattern = entries.map((entry) => entry.count);
  const valueSet = new Set(values);
  const isRoyalFlush = [1, 2, 3, 4, 5].every((value) => valueSet.has(value));
  const isFlush = [2, 3, 4, 5, 6].every((value) => valueSet.has(value));

  if (isRoyalFlush) {
    return {
      rank: HAND_RANK.royal_flush,
      category: "royal_flush",
      tieBreak: values
    };
  }

  if (countPattern[0] >= 5) {
    return {
      rank: HAND_RANK.five_kind,
      category: "five_kind",
      tieBreak: values
    };
  }

  if (countPattern[0] >= 4) {
    const kicker = entries.find((entry) => entry.count < 4)?.value || 0;
    return {
      rank: HAND_RANK.four_kind,
      category: "four_kind",
      tieBreak: [entries[0].value, kicker]
    };
  }

  const triple = entries.find((entry) => entry.count >= 3) || null;
  const pair = entries.find((entry) => entry.value !== triple?.value && entry.count >= 2) || null;
  if (triple && pair) {
    return {
      rank: HAND_RANK.full_house,
      category: "full_house",
      tieBreak: [triple.value, pair.value]
    };
  }

  if (isFlush) {
    return {
      rank: HAND_RANK.flush,
      category: "flush",
      tieBreak: values
    };
  }

  if (countPattern[0] >= 3) {
    const kickers = entries
      .filter((entry) => entry.value !== entries[0].value)
      .map((entry) => entry.value)
      .sort((a, b) => b - a);
    return {
      rank: HAND_RANK.three_kind,
      category: "three_kind",
      tieBreak: [entries[0].value, ...kickers]
    };
  }

  if ((countPattern[0] || 0) >= 2 && (countPattern[1] || 0) >= 2) {
    const pairs = entries
      .filter((entry) => entry.count >= 2)
      .map((entry) => entry.value)
      .sort((a, b) => b - a);
    const kicker = entries.find((entry) => entry.count < 2)?.value || 0;
    return {
      rank: HAND_RANK.two_pair,
      category: "two_pair",
      tieBreak: [...pairs, kicker]
    };
  }

  if ((countPattern[0] || 0) >= 2) {
    const pairValue = entries.find((entry) => entry.count >= 2)?.value || 0;
    const kickers = entries
      .filter((entry) => entry.value !== pairValue)
      .map((entry) => entry.value)
      .sort((a, b) => b - a);
    return {
      rank: HAND_RANK.one_pair,
      category: "one_pair",
      tieBreak: [pairValue, ...kickers]
    };
  }

  return {
    rank: HAND_RANK.high_card,
    category: "high_card",
    tieBreak: values
  };
}

function getCategoryPoints(category) {
  if (category === "royal_flush") return 20;
  if (category === "flush") return 16;
  if (category === "five_kind") return 12;
  if (category === "four_kind") return 10;
  if (category === "full_house") return 8;
  if (category === "three_kind") return 4;
  if (category === "two_pair") return 2;
  if (category === "one_pair") return 0;
  return 0;
}

function compareHands(left, right) {
  if (!left || !right) return 0;
  if (left.rank !== right.rank) {
    return left.rank > right.rank ? 1 : -1;
  }
  return compareNumberArrays(left.tieBreak, right.tieBreak);
}

function finalizePlayerHand(state, playerId) {
  const dice = state.currentHand.diceByPlayer[playerId];
  const ranking = classifyHand(dice);
  const bankedPoints = getCategoryPoints(ranking.category);
  const pointsAfterBank = Number(state.pointsByPlayer?.[playerId] || 0) + bankedPoints;
  const finalByPlayer = {
    ...state.currentHand.finalByPlayer,
    [playerId]: {
      playerId,
      dice: [...dice],
      rank: ranking.rank,
      category: ranking.category,
      tieBreak: ranking.tieBreak,
      bankedPoints,
      pointsAfterBank
    }
  };

  return {
    state: {
      ...state,
      pointsByPlayer: {
        ...state.pointsByPlayer,
        [playerId]: pointsAfterBank
      },
      currentHand: {
        ...state.currentHand,
        finalByPlayer,
        locksByPlayer: {
          ...state.currentHand.locksByPlayer,
          [playerId]: createLockArray()
        }
      },
      history: [
        ...state.history,
        {
          type: "bank",
          playerId,
          handNumber: state.currentHandNumber,
          bankedCategory: ranking.category,
          bankedPoints,
          pointsAfterBank
        }
      ]
    }
  };
}

function startHand(state, { handNumber, handStarterId }) {
  return {
    ...state,
    phase: "rolling",
    currentHandNumber: handNumber,
    handStarterId,
    nextPlayerId: handStarterId,
    currentHand: createHandState(state.playerOrder)
  };
}

function resolveFinalizedHand(state) {
  const [p1, p2] = state.playerOrder;
  const left = state.currentHand.finalByPlayer[p1];
  const right = state.currentHand.finalByPlayer[p2];
  if (!left || !right) return state;

  const comparison = compareHands(left, right);
  const handWinnerId = comparison > 0 ? p1 : (comparison < 0 ? p2 : null);
  const nextHandWins = {
    ...state.handWins
  };
  if (handWinnerId) {
    nextHandWins[handWinnerId] = Number(state.handWins[handWinnerId] || 0) + 1;
  }

  const nextState = {
    ...state,
    handWins: nextHandWins,
    handTies: state.handTies + (handWinnerId ? 0 : 1),
    history: [
      ...state.history,
      {
        type: "hand_result",
        handNumber: state.currentHandNumber,
        winnerId: handWinnerId,
        left,
        right
      }
    ]
  };

  if (state.currentHandNumber >= MAX_HANDS) {
    const p1Points = Number(nextState.pointsByPlayer?.[p1] || 0);
    const p2Points = Number(nextState.pointsByPlayer?.[p2] || 0);
    const winnerId = p1Points === p2Points ? null : (p1Points > p2Points ? p1 : p2);
    return {
      ...nextState,
      phase: "finished",
      winnerId,
      draw: !winnerId,
      nextPlayerId: null
    };
  }

  // Strict alternation across the entire match: the next hand starts with the
  // opposite of the player who just finished this hand.
  const previousTurnPlayerId = state.nextPlayerId || state.handStarterId;
  const nextStarter = getOtherPlayerId(state, previousTurnPlayerId) || previousTurnPlayerId;
  return startHand(nextState, {
    handNumber: state.currentHandNumber + 1,
    handStarterId: nextStarter
  });
}

export function createPokerDiceEngine() {
  return {
    init(players) {
      const [p1, p2] = players;
      const playerOrder = [p1?.id, p2?.id].filter(Boolean);
      const starter = playerOrder[0] || null;

      return {
        playerOrder,
        phase: "rolling",
        bestOfHands: MAX_HANDS,
        handWinsRequired: MAX_HANDS,
        currentHandNumber: 1,
        handStarterId: starter,
        nextPlayerId: starter,
        winnerId: null,
        draw: false,
        handWins: buildPlayerMap(playerOrder, () => 0),
        pointsByPlayer: buildPlayerMap(playerOrder, () => 0),
        handTies: 0,
        currentHand: createHandState(playerOrder),
        history: []
      };
    },

    applyMove(state, move, playerId) {
      if (state.winnerId || state.draw || state.phase === "finished") {
        return { error: "Game is already finished." };
      }

      if (!state.playerOrder.includes(playerId)) {
        return { error: "Unknown player." };
      }

      if (playerId !== state.nextPlayerId) {
        return { error: "Not your turn." };
      }

      if (state.currentHand.finalByPlayer[playerId]) {
        return { error: "You already banked this hand." };
      }

      const action = String(move?.action || "roll").trim().toLowerCase();
      if (action !== "roll" && action !== "bank") {
        return { error: "Invalid poker dice action." };
      }

      if (action === "bank") {
        const rollsUsed = Number(state.currentHand.rollsUsedByPlayer[playerId] || 0);
        if (rollsUsed < 1) {
          return { error: "Roll at least once before banking." };
        }

        const withFinalized = finalizePlayerHand(state, playerId).state;

        const otherId = getOtherPlayerId(state, playerId);
        if (!withFinalized.currentHand.finalByPlayer[otherId]) {
          return {
            state: {
              ...withFinalized,
              nextPlayerId: otherId
            }
          };
        }

        return { state: resolveFinalizedHand(withFinalized) };
      }

      const rollsUsed = Number(state.currentHand.rollsUsedByPlayer[playerId] || 0);
      if (rollsUsed >= MAX_ROLLS_PER_PLAYER) {
        return { error: "No rolls remaining. Bank your hand." };
      }

      const holdIndices = normalizeHoldIndices(move?.hold);
      const holdSet = new Set(rollsUsed > 0 ? holdIndices : []);
      const previousDice = state.currentHand.diceByPlayer[playerId] || createEmptyDice();

      const nextDice = previousDice.map((value, index) => {
        if (holdSet.has(index) && Number.isInteger(value)) {
          return value;
        }
        return rollDie();
      });

      const nextRollsUsed = rollsUsed + 1;
      const currentHand = {
        ...state.currentHand,
        rollsUsedByPlayer: {
          ...state.currentHand.rollsUsedByPlayer,
          [playerId]: nextRollsUsed
        },
        diceByPlayer: {
          ...state.currentHand.diceByPlayer,
          [playerId]: nextDice
        },
        locksByPlayer: {
          ...state.currentHand.locksByPlayer,
          [playerId]: nextDice.map((_, index) => holdSet.has(index))
        }
      };

      const rolledState = {
        ...state,
        currentHand,
        history: [
          ...state.history,
          {
            type: "roll",
            playerId,
            handNumber: state.currentHandNumber,
            rollsUsed: nextRollsUsed,
            hold: [...holdSet],
            dice: [...nextDice]
          }
        ]
      };

      if (nextRollsUsed < MAX_ROLLS_PER_PLAYER) {
        return {
          state: {
            ...rolledState,
            nextPlayerId: playerId
          }
        };
      }

      const withFinalized = finalizePlayerHand(rolledState, playerId).state;

      const otherId = getOtherPlayerId(state, playerId);
      if (!withFinalized.currentHand.finalByPlayer[otherId]) {
        return {
          state: {
            ...withFinalized,
            nextPlayerId: otherId
          }
        };
      }

      return { state: resolveFinalizedHand(withFinalized) };
    }
  };
}
