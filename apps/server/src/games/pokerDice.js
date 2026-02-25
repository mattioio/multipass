const DICE_PER_HAND = 5;
const MAX_ROLLS_PER_PLAYER = 3;
const HANDS_TO_WIN = 2;
const MAX_HANDS = 3;

const HAND_RANK = Object.freeze({
  high_card: 0,
  one_pair: 1,
  two_pair: 2,
  three_kind: 3,
  straight: 4,
  full_house: 5,
  four_kind: 6,
  five_kind: 7
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
  const sortedAsc = [...dice].sort((a, b) => a - b);
  const isStraight =
    sortedAsc.join(",") === "1,2,3,4,5" ||
    sortedAsc.join(",") === "2,3,4,5,6";

  if (countPattern[0] === 5) {
    return {
      rank: HAND_RANK.five_kind,
      category: "five_kind",
      tieBreak: [entries[0].value]
    };
  }

  if (countPattern[0] === 4) {
    const kicker = entries.find((entry) => entry.count === 1)?.value || 0;
    return {
      rank: HAND_RANK.four_kind,
      category: "four_kind",
      tieBreak: [entries[0].value, kicker]
    };
  }

  if (countPattern[0] === 3 && countPattern[1] === 2) {
    return {
      rank: HAND_RANK.full_house,
      category: "full_house",
      tieBreak: [entries[0].value, entries[1].value]
    };
  }

  if (isStraight) {
    return {
      rank: HAND_RANK.straight,
      category: "straight",
      tieBreak: [Math.max(...sortedAsc)]
    };
  }

  if (countPattern[0] === 3) {
    const kickers = entries.filter((entry) => entry.count === 1).map((entry) => entry.value).sort((a, b) => b - a);
    return {
      rank: HAND_RANK.three_kind,
      category: "three_kind",
      tieBreak: [entries[0].value, ...kickers]
    };
  }

  if (countPattern[0] === 2 && countPattern[1] === 2) {
    const pairs = entries.filter((entry) => entry.count === 2).map((entry) => entry.value).sort((a, b) => b - a);
    const kicker = entries.find((entry) => entry.count === 1)?.value || 0;
    return {
      rank: HAND_RANK.two_pair,
      category: "two_pair",
      tieBreak: [...pairs, kicker]
    };
  }

  if (countPattern[0] === 2) {
    const pairValue = entries.find((entry) => entry.count === 2)?.value || 0;
    const kickers = entries.filter((entry) => entry.count === 1).map((entry) => entry.value).sort((a, b) => b - a);
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
  const finalByPlayer = {
    ...state.currentHand.finalByPlayer,
    [playerId]: {
      playerId,
      dice: [...dice],
      rank: ranking.rank,
      category: ranking.category,
      tieBreak: ranking.tieBreak
    }
  };

  return {
    ...state.currentHand,
    finalByPlayer,
    locksByPlayer: {
      ...state.currentHand.locksByPlayer,
      [playerId]: createLockArray()
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
  if (comparison === 0) {
    return {
      ...startHand(state, {
        handNumber: state.currentHandNumber,
        handStarterId: state.handStarterId
      }),
      handTies: state.handTies + 1,
      history: [
        ...state.history,
        {
          type: "hand_tie",
          handNumber: state.currentHandNumber,
          left,
          right
        }
      ]
    };
  }

  const handWinnerId = comparison > 0 ? p1 : p2;
  const nextHandWins = {
    ...state.handWins,
    [handWinnerId]: Number(state.handWins[handWinnerId] || 0) + 1
  };

  const nextState = {
    ...state,
    handWins: nextHandWins,
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

  if (nextHandWins[handWinnerId] >= HANDS_TO_WIN) {
    return {
      ...nextState,
      phase: "finished",
      winnerId: handWinnerId,
      draw: false,
      nextPlayerId: null
    };
  }

  const nextStarter = getOtherPlayerId(state, state.handStarterId) || state.handStarterId;
  return startHand(nextState, {
    handNumber: state.currentHandNumber + 1,
    handStarterId: nextStarter
  });
}

function init(players) {
  const [p1, p2] = players;
  const playerOrder = [p1?.id, p2?.id].filter(Boolean);
  const starter = playerOrder[0] || null;

  return {
    playerOrder,
    phase: "rolling",
    bestOfHands: MAX_HANDS,
    handWinsRequired: HANDS_TO_WIN,
    currentHandNumber: 1,
    handStarterId: starter,
    nextPlayerId: starter,
    winnerId: null,
    draw: false,
    handWins: buildPlayerMap(playerOrder, () => 0),
    handTies: 0,
    currentHand: createHandState(playerOrder),
    history: []
  };
}

function applyMove(state, move, playerId) {
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

    const withFinalized = {
      ...state,
      currentHand: finalizePlayerHand(state, playerId)
    };

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

  const withFinalized = {
    ...rolledState,
    currentHand: finalizePlayerHand(rolledState, playerId)
  };

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

export default {
  id: "poker_dice",
  name: "Poker Dice",
  minPlayers: 2,
  maxPlayers: 2,
  init,
  applyMove
};
