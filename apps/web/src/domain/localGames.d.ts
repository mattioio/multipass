import type { LocalGameEngine } from "../types";

export interface LocalGameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  comingSoon: boolean;
  bannerKey: string;
  surfaceType: string;
  mode: "board" | "dice" | "card";
  visibility: "public" | "hidden_pass_device";
  getWinRevealReason?: (state: Record<string, unknown>, context: unknown) => unknown;
  init?: LocalGameEngine["init"];
  applyMove?: LocalGameEngine["applyMove"];
  getVisibleState?: LocalGameEngine["getVisibleState"];
}

export const localGames: Record<string, LocalGameDefinition>;

export function listLocalGames(): Array<{
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  comingSoon: boolean;
  bannerKey: string;
  mode: "board" | "dice" | "card";
  visibility: "public" | "hidden_pass_device";
}>;

export function getLocalGame(gameId: string | null | undefined): LocalGameDefinition | null;

export function isTicTacToeSurfaceGame(gameId: string | null | undefined): boolean;
