const DOT_COUNT = 6;
const BOX_SPAN = DOT_COUNT - 1;
const HORIZONTAL_EDGE_COUNT = DOT_COUNT * BOX_SPAN;
const VERTICAL_EDGE_COUNT = BOX_SPAN * DOT_COUNT;
const TOTAL_EDGE_COUNT = HORIZONTAL_EDGE_COUNT + VERTICAL_EDGE_COUNT;
const TOTAL_BOX_COUNT = BOX_SPAN * BOX_SPAN;

function getHorizontalEdgeIndex(row, col) {
  return row * BOX_SPAN + col;
}

function getVerticalEdgeIndex(row, col) {
  return HORIZONTAL_EDGE_COUNT + (row * DOT_COUNT) + col;
}

function getBoxEdgeIndices(boxIndex) {
  const row = Math.floor(boxIndex / BOX_SPAN);
  const col = boxIndex % BOX_SPAN;
  return [
    getHorizontalEdgeIndex(row, col),
    getHorizontalEdgeIndex(row + 1, col),
    getVerticalEdgeIndex(row, col),
    getVerticalEdgeIndex(row, col + 1)
  ];
}

function getAdjacentBoxesForEdge(edgeIndex) {
  if (edgeIndex < HORIZONTAL_EDGE_COUNT) {
    const row = Math.floor(edgeIndex / BOX_SPAN);
    const col = edgeIndex % BOX_SPAN;
    const boxes = [];
    if (row > 0) {
      boxes.push((row - 1) * BOX_SPAN + col);
    }
    if (row < BOX_SPAN) {
      boxes.push(row * BOX_SPAN + col);
    }
    return boxes;
  }

  const verticalIndex = edgeIndex - HORIZONTAL_EDGE_COUNT;
  const row = Math.floor(verticalIndex / DOT_COUNT);
  const col = verticalIndex % DOT_COUNT;
  const boxes = [];
  if (col > 0) {
    boxes.push(row * BOX_SPAN + (col - 1));
  }
  if (col < BOX_SPAN) {
    boxes.push(row * BOX_SPAN + col);
  }
  return boxes;
}

function isBoxComplete(edges, boxIndex) {
  const edgeIndices = getBoxEdgeIndices(boxIndex);
  return edgeIndices.every((index) => edges[index] !== null);
}

function getOtherPlayerId(state, playerId) {
  return state.playerOrder.find((id) => id !== playerId) || null;
}

function getWinner(scores, playerOrder) {
  if (playerOrder.length < 2) {
    return { winnerId: null, draw: true };
  }
  const [p1, p2] = playerOrder;
  const score1 = Number(scores[p1] || 0);
  const score2 = Number(scores[p2] || 0);
  if (score1 === score2) {
    return { winnerId: null, draw: true };
  }
  return {
    winnerId: score1 > score2 ? p1 : p2,
    draw: false
  };
}

export function createDotsAndBoxesEngine() {
  return {
    init(players) {
      const [p1, p2] = players;
      const playerOrder = [p1?.id, p2?.id].filter(Boolean);
      const scores = Object.fromEntries(playerOrder.map((id) => [id, 0]));

      return {
        dotCount: DOT_COUNT,
        playerOrder,
        nextPlayerId: playerOrder[0] || null,
        winnerId: null,
        draw: false,
        edges: Array(TOTAL_EDGE_COUNT).fill(null),
        boxes: Array(TOTAL_BOX_COUNT).fill(null),
        scores,
        history: []
      };
    },

    applyMove(state, move, playerId) {
      if (state.winnerId || state.draw) {
        return { error: "Game is already finished." };
      }

      if (!state.playerOrder.includes(playerId)) {
        return { error: "Unknown player." };
      }

      if (playerId !== state.nextPlayerId) {
        return { error: "Not your turn." };
      }

      const edgeIndex = Number(move?.edgeIndex);
      if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= TOTAL_EDGE_COUNT) {
        return { error: "Invalid move." };
      }

      if (state.edges[edgeIndex] !== null) {
        return { error: "That edge is already taken." };
      }

      const edges = state.edges.slice();
      edges[edgeIndex] = playerId;
      const boxes = state.boxes.slice();
      const scores = { ...state.scores };

      const completedBoxIndices = [];
      for (const boxIndex of getAdjacentBoxesForEdge(edgeIndex)) {
        if (boxes[boxIndex] !== null) continue;
        if (!isBoxComplete(edges, boxIndex)) continue;
        boxes[boxIndex] = playerId;
        completedBoxIndices.push(boxIndex);
        scores[playerId] = Number(scores[playerId] || 0) + 1;
      }

      const allBoxesClaimed = boxes.every((ownerId) => ownerId !== null);
      const allEdgesClaimed = edges.every((ownerId) => ownerId !== null);
      const isFinished = allBoxesClaimed || allEdgesClaimed;

      let nextPlayerId = null;
      let winnerId = null;
      let draw = false;

      if (isFinished) {
        const result = getWinner(scores, state.playerOrder);
        winnerId = result.winnerId;
        draw = result.draw;
      } else if (completedBoxIndices.length > 0) {
        nextPlayerId = playerId;
      } else {
        nextPlayerId = getOtherPlayerId(state, playerId);
      }

      return {
        state: {
          ...state,
          edges,
          boxes,
          scores,
          nextPlayerId,
          winnerId,
          draw,
          history: [
            ...state.history,
            {
              playerId,
              edgeIndex,
              completedBoxIndices
            }
          ]
        }
      };
    }
  };
}
