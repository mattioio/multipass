import type { GameRuntimeState } from "./GameRuntimeState";

export interface GameComponentProps<TState = Record<string, unknown>> {
  gameId: string;
  name: string;
  runtime: GameRuntimeState<TState>;
  onPrimaryAction?: () => void;
}
