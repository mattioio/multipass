import ticTacToe from "./ticTacToe.js";
import dotsAndBoxes from "./dotsAndBoxes.js";

const games = {
  [ticTacToe.id]: {
    ...ticTacToe,
    comingSoon: false,
    bannerKey: "tic_tac_toe"
  },
  [dotsAndBoxes.id]: {
    ...dotsAndBoxes,
    comingSoon: false,
    bannerKey: "dots_and_boxes"
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
