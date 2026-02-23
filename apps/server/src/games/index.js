import ticTacToe from "./ticTacToe.js";

const games = {
  [ticTacToe.id]: {
    ...ticTacToe,
    comingSoon: false,
    bannerKey: "tic_tac_toe"
  }
};

export function listGames() {
  return Object.values(games).map((game) => ({
    id: game.id,
    name: game.name,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    comingSoon: Boolean(game.comingSoon),
    bannerKey: game.bannerKey || game.id
  }));
}

export default games;
