import { gameCatalog, listCatalogGames } from "./games/catalog.js";

export const localGames = Object.fromEntries(
  Object.values(gameCatalog).map((game) => [
    game.id,
    {
      id: game.id,
      name: game.name,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      comingSoon: Boolean(game.comingSoon),
      bannerKey: game.bannerKey || game.id,
      surfaceType: game.surfaceType || "placeholder",
      mode: game.mode || "board",
      visibility: game.visibility || "public",
      init: game.localEngine?.init,
      applyMove: game.localEngine?.applyMove,
      getVisibleState: game.localEngine?.getVisibleState
    }
  ])
);

export function listLocalGames() {
  return listCatalogGames().map((game) => ({
    id: game.id,
    name: game.name,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    comingSoon: Boolean(game.comingSoon),
    bannerKey: game.bannerKey || game.id,
    mode: game.mode || "board",
    visibility: game.visibility || "public"
  }));
}

export function getLocalGame(gameId) {
  return localGames[gameId] || null;
}

export function isTicTacToeSurfaceGame(gameId) {
  return getLocalGame(gameId)?.surfaceType === "tic_tac_toe";
}
