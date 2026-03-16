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
  mode: "board" | "dice" | "card";
  visibility: "public" | "hidden_pass_device";
  blurb?: string;
  localEngine?: LocalGameEngine;
}

export const gameCatalog: Record<string, CatalogGameDefinition>;

export function listCatalogGames(): CatalogGameDefinition[];

export function getCatalogGame(gameId: string | null | undefined): CatalogGameDefinition | null;
