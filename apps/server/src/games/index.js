import ticTacToe from "./ticTacToe.js";

const games = {
  [ticTacToe.id]: ticTacToe
};

export function listGames() {
  return Object.values(games).map((game) => ({
    id: game.id,
    name: game.name,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers
  }));
}

export default games;
