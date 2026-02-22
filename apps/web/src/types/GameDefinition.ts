import type { ComponentType } from "react";
import type { GameComponentProps } from "./GameComponentProps";

export interface LocalGameEngine<TState = Record<string, unknown>> {
  init: (players: Array<{ id: string }>) => TState;
  applyMove: (
    state: TState,
    move: Record<string, unknown>,
    playerId: string
  ) => { state: TState } | { error: string };
  getVisibleState?: (state: TState, viewerPlayerId: string | null) => Record<string, unknown>;
}

export interface GameDefinition<TState = Record<string, unknown>> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  bannerKey: string;
  isAvailable: boolean;
  comingSoon: boolean;
  surfaceType: string;
  mode: "board" | "dice" | "card";
  visibility: "public" | "hidden_pass_device";
  Component: ComponentType<GameComponentProps<TState>>;
  localEngine?: LocalGameEngine<TState>;
}

export type GameRegistry = Record<string, GameDefinition>;
