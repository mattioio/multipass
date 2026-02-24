import gamesCatalog, { listGames } from "../../games/index.js";

export function createGameService() {
  return {
    getGame(gameId) {
      return gamesCatalog[gameId] || null;
    },
    hasGame(gameId) {
      return Boolean(gamesCatalog[gameId]);
    },
    listPublicGames() {
      return listGames();
    }
  };
}
