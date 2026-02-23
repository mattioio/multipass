import { createBattleshipsEngine } from "./engines/battleshipsEngine.js";

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

function getWinner(board, symbols) {
  for (const [a, b, c] of LINES) {
    const val = board[a];
    if (!val) continue;
    if (val === board[b] && val === board[c]) {
      const entry = Object.entries(symbols).find(([, symbol]) => symbol === val);
      if (entry) {
        return {
          winnerId: entry[0],
          winningLine: [a, b, c]
        };
      }
    }
  }
  return {
    winnerId: null,
    winningLine: null
  };
}

function createTicTacToeEngine() {
  return {
    init(players) {
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
        winningLine: null,
        draw: false,
        history: []
      };
    },
    applyMove(state, move, playerId) {
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

      const { winnerId, winningLine } = getWinner(board, state.symbols);
      const draw = !winnerId && board.every((cell) => cell !== null);
      const nextPlayerId = winnerId || draw
        ? null
        : (playerId === state.playerOrder[0] ? state.playerOrder[1] : state.playerOrder[0]);

      return {
        state: {
          ...state,
          board,
          winnerId,
          winningLine,
          draw,
          nextPlayerId,
          history: [...state.history, { playerId, index }]
        }
      };
    }
  };
}

function createTicTacToeConfig({ id, name, bannerKey = "tic_tac_toe" }) {
  return {
    id,
    name,
    minPlayers: 2,
    maxPlayers: 2,
    comingSoon: false,
    isAvailable: true,
    bannerKey,
    surfaceType: "tic_tac_toe",
    mode: "board",
    visibility: "public",
    localEngine: createTicTacToeEngine()
  };
}

export const gameCatalog = {
  tic_tac_toe: createTicTacToeConfig({
    id: "tic_tac_toe",
    name: "Tic Tac Toe"
  }),
  battleships: {
    id: "battleships",
    name: "Battleships",
    minPlayers: 2,
    maxPlayers: 2,
    comingSoon: false,
    isAvailable: false,
    bannerKey: "battleships",
    surfaceType: "placeholder",
    mode: "board",
    visibility: "hidden_pass_device",
    localEngine: createBattleshipsEngine()
  }
};

export function listCatalogGames() {
  return Object.values(gameCatalog).map((game) => ({ ...game }));
}

export function getCatalogGame(gameId) {
  return gameCatalog[gameId] || null;
}
