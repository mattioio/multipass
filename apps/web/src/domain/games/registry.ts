import type { GameDefinition, GameRegistry } from "../../types";
import { gameCatalog } from "./catalog.js";
import { TicTacToeSurface, UnavailableGameSurface } from "./surfaces";

const unknownGameDefinition: GameDefinition = {
  id: "unknown",
  name: "Unknown game",
  minPlayers: 2,
  maxPlayers: 2,
  bannerKey: "tic_tac_toe",
  isAvailable: false,
  comingSoon: true,
  surfaceType: "placeholder",
  Component: UnavailableGameSurface
};

function resolveSurfaceComponent(surfaceType: string, isAvailable: boolean) {
  if (!isAvailable) return UnavailableGameSurface;
  if (surfaceType === "tic_tac_toe") return TicTacToeSurface;
  return UnavailableGameSurface;
}

export const gameRegistry: GameRegistry = Object.fromEntries(
  Object.values(gameCatalog).map((catalogGame) => {
    const Component = resolveSurfaceComponent(catalogGame.surfaceType, Boolean(catalogGame.isAvailable));
    const definition: GameDefinition = {
      id: catalogGame.id,
      name: catalogGame.name,
      minPlayers: catalogGame.minPlayers,
      maxPlayers: catalogGame.maxPlayers,
      bannerKey: catalogGame.bannerKey || catalogGame.id,
      isAvailable: Boolean(catalogGame.isAvailable),
      comingSoon: Boolean(catalogGame.comingSoon),
      surfaceType: catalogGame.surfaceType || "placeholder",
      Component,
      localEngine: catalogGame.localEngine
    };
    return [definition.id, definition];
  })
);

export function assertValidGameRegistry(registry: GameRegistry = gameRegistry) {
  const ids = Object.keys(registry);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("Duplicate game IDs found in registry.");
  }

  for (const [id, game] of Object.entries(registry)) {
    if (!id || !game.id || id !== game.id) {
      throw new Error(`Invalid game entry for key: ${id}`);
    }
    if (!game.name || typeof game.Component !== "function") {
      throw new Error(`Game entry '${id}' is missing required fields.`);
    }
  }
}

export function listGameDefinitions(options: { includeUnavailable?: boolean } = {}) {
  const includeUnavailable = options.includeUnavailable ?? true;
  const games = Object.values(gameRegistry);
  if (includeUnavailable) {
    return games;
  }
  return games.filter((game) => game.isAvailable && !game.comingSoon);
}

export function getGameDefinition(gameId: string | null | undefined) {
  if (!gameId) return null;
  return gameRegistry[gameId] || null;
}

export function getGameDefinitionOrFallback(gameId: string | null | undefined): GameDefinition {
  const game = getGameDefinition(gameId);
  if (!game) {
    return {
      ...unknownGameDefinition,
      id: String(gameId || unknownGameDefinition.id),
      name: "Unknown game"
    };
  }
  return game;
}
