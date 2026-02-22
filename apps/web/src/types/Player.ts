import type { ThemeKey } from "./ThemeKey";

export interface Player {
  id: string;
  name: string;
  honorific?: "mr" | "mrs";
  theme?: ThemeKey;
  role?: "host" | "guest" | "local" | string;
  score?: number;
  gamesWon?: number;
  ready?: boolean;
  connected?: boolean;
}
