import { getCatalogGame } from "./catalog.js";

const REMOVED_GAME_IDS = new Set(["battleships"]);

function mergeCatalogMetadata(game) {
  if (!game || !game.id) return game;
  const catalogGame = getCatalogGame(game.id);
  if (!catalogGame) return game;

  return {
    ...catalogGame,
    ...game,
    bannerKey: game.bannerKey || catalogGame.bannerKey || game.id,
    comingSoon: typeof game.comingSoon === "boolean" ? game.comingSoon : Boolean(catalogGame.comingSoon)
  };
}

export function resolvePickerGames(games = []) {
  return games
    .filter((game) => !REMOVED_GAME_IDS.has(String(game?.id || "").toLowerCase()))
    .map((game) => mergeCatalogMetadata(game));
}
