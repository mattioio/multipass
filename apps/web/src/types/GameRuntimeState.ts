export type GameUiState = "idle" | "active" | "disabled" | "waiting" | "error" | "complete";

export interface GameRuntimeState<TState = Record<string, unknown>> {
  uiState: GameUiState;
  state: TState;
  error?: string | null;
}
