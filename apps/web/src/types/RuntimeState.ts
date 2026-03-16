import type { RoomState } from "./RoomState";

export type RuntimeConnectionStatus = "connected" | "connecting" | "disconnected" | "reconnecting";
export type RuntimeAppMode = "online" | "local";

export interface RuntimeYouState {
  clientId: string | null;
  playerId: string | null;
  role: string | null;
  roomCode: string | null;
}

export interface RuntimeJoinPreviewPlayer {
  id?: string | null;
  name?: string;
  honorific?: "mr" | "mrs";
  theme?: string;
  role?: string;
  score?: number;
  gamesWon?: number;
  ready?: boolean;
  connected?: boolean;
}

export interface RuntimeJoinPreview {
  code?: string;
  canRejoin?: boolean;
  takenThemes?: string[];
  host?: RuntimeJoinPreviewPlayer | null;
  guest?: RuntimeJoinPreviewPlayer | null;
}

export interface RuntimeJoinState {
  code: string;
  status: "idle" | "validating" | "ready" | "error";
  message: string;
  preview: RuntimeJoinPreview | null;
}

export interface RuntimeState {
  mode: RuntimeAppMode;
  ws: WebSocket | null;
  connectionStatus: RuntimeConnectionStatus;
  room: RoomState | null;
  you: RuntimeYouState | null;
  clientId: string | null;
  seatToken: string | null;
  lastRoomCode: string | null;
  lastRoomStartedAt: number | null;
  join: RuntimeJoinState;
}
