import type { ScreenKey } from "./ScreenKey";

export interface AppUiState {
  activeScreen: ScreenKey;
  hasRoom: boolean;
  roomCode: string | null;
  connectionStatus: "connected" | "connecting" | "disconnected" | "reconnecting";
  currentGameId: string | null;
}
