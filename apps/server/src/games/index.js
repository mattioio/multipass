import ticTacToe from "./ticTacToe.js";
import dotsAndBoxes from "./dotsAndBoxes.js";
import wordFight from "./wordFight.js";
import pokerDice from "./pokerDice.js";

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
  },
  [wordFight.id]: {
    ...wordFight,
    comingSoon: false,
    bannerKey: "word_fight"
  },
  [pokerDice.id]: {
    ...pokerDice,
    comingSoon: false,
    bannerKey: "poker_dice"
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
