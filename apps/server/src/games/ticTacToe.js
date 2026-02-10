const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function getWinnerId(board, symbols) {
  for (const [a, b, c] of LINES) {
    const val = board[a];
    if (!val) continue;
    if (val === board[b] && val === board[c]) {
      const entry = Object.entries(symbols).find(([, symbol]) => symbol === val);
      if (entry) return entry[0];
    }
  }
  return null;
}

function init(players) {
  const [p1, p2] = players;
  const symbols = {
    [p1.id]: "X",
    [p2.id]: "O"
  };

  return {
    board: Array(9).fill(null),
    playerOrder: [p1.id, p2.id],
    symbols,
    nextPlayerId: p1.id,
    winnerId: null,
    draw: false,
    history: []
  };
}

function applyMove(state, move, playerId) {
  if (state.winnerId || state.draw) {
    return { error: "Game is already finished." };
  }

  if (playerId !== state.nextPlayerId) {
    return { error: "Not your turn." };
  }

  const index = Number(move?.index);
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    return { error: "Invalid move." };
  }

  if (state.board[index] !== null) {
    return { error: "That space is already taken." };
  }

  const board = state.board.slice();
  board[index] = state.symbols[playerId];

  const winnerId = getWinnerId(board, state.symbols);
  const draw = !winnerId && board.every((cell) => cell !== null);

  const nextPlayerId = winnerId || draw
    ? null
    : (playerId === state.playerOrder[0] ? state.playerOrder[1] : state.playerOrder[0]);

  return {
    state: {
      ...state,
      board,
      winnerId,
      draw,
      nextPlayerId,
      history: [...state.history, { playerId, index }]
    }
  };
}

export default {
  id: "tic_tac_toe",
  name: "Tic Tac Toe",
  minPlayers: 2,
  maxPlayers: 2,
  init,
  applyMove
};
