import ticTacToe from "./ticTacToe.js";

const battleships = {
  id: "battleships",
  name: "Battleships",
  minPlayers: 2,
  maxPlayers: 2,
  comingSoon: true,
  bannerKey: "battleships"
};

const zombieDice = {
  id: "zombie_dice",
  name: "Zombie Dice",
  minPlayers: 2,
  maxPlayers: 2,
  comingSoon: true,
  bannerKey: "zombie_dice"
};

const games = {
  [ticTacToe.id]: {
    ...ticTacToe,
    comingSoon: false,
    bannerKey: "tic_tac_toe"
  },
  [battleships.id]: battleships,
  [zombieDice.id]: zombieDice
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
