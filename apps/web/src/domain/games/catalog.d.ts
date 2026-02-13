import type { LocalGameEngine } from "../../types";

export interface CatalogGameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  comingSoon: boolean;
  isAvailable: boolean;
  bannerKey: string;
  surfaceType: string;
  localEngine?: LocalGameEngine;
}

export const gameCatalog: Record<string, CatalogGameDefinition>;

export function listCatalogGames(): CatalogGameDefinition[];

export function getCatalogGame(gameId: string | null | undefined): CatalogGameDefinition | null;
