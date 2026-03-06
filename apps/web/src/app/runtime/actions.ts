import type { RuntimeAppMode, RuntimeConnectionStatus, RuntimeJoinPreview, RuntimeYouState, RoomState } from "../../types";

export type RuntimeAction =
  | { type: "RUNTIME_WS_SET"; payload: { ws: WebSocket | null } }
  | { type: "RUNTIME_CONNECTION_STATUS_SET"; payload: { status: RuntimeConnectionStatus } }
  | { type: "RUNTIME_MODE_SET"; payload: { mode: RuntimeAppMode } }
  | { type: "RUNTIME_SETTINGS_OPEN_SET"; payload: { open: boolean } }
  | { type: "RUNTIME_JOIN_CODE_SET"; payload: { code: string } }
  | { type: "RUNTIME_JOIN_VALIDATING" }
  | { type: "RUNTIME_JOIN_READY"; payload: { preview: RuntimeJoinPreview | null; message?: string } }
  | { type: "RUNTIME_JOIN_ERROR"; payload: { message: string } }
  | { type: "RUNTIME_SESSION_RECEIVED"; payload: { clientId: string | null; seatToken?: string | null } }
  | { type: "RUNTIME_LAST_ROOM_SET"; payload: { code: string | null; startedAt: number | null } }
  | { type: "RUNTIME_ROOM_STATE_RECEIVED"; payload: { room: RoomState; you: RuntimeYouState | null } }
  | { type: "RUNTIME_ROOM_CLEARED" };

export const runtimeActions = {
  wsSet(ws: WebSocket | null): RuntimeAction {
    return { type: "RUNTIME_WS_SET", payload: { ws } };
  },
  connectionStatusSet(status: RuntimeConnectionStatus): RuntimeAction {
    return { type: "RUNTIME_CONNECTION_STATUS_SET", payload: { status } };
  },
  modeSet(mode: RuntimeAppMode): RuntimeAction {
    return { type: "RUNTIME_MODE_SET", payload: { mode } };
  },
  settingsOpenSet(open: boolean): RuntimeAction {
    return { type: "RUNTIME_SETTINGS_OPEN_SET", payload: { open } };
  },
  joinCodeSet(code: string): RuntimeAction {
    return { type: "RUNTIME_JOIN_CODE_SET", payload: { code } };
  },
  joinValidating(): RuntimeAction {
    return { type: "RUNTIME_JOIN_VALIDATING" };
  },
  joinReady(preview: RuntimeJoinPreview | null, message = ""): RuntimeAction {
    return { type: "RUNTIME_JOIN_READY", payload: { preview, message } };
  },
  joinError(message: string): RuntimeAction {
    return { type: "RUNTIME_JOIN_ERROR", payload: { message } };
  },
  sessionReceived(clientId: string | null, seatToken?: string | null): RuntimeAction {
    return { type: "RUNTIME_SESSION_RECEIVED", payload: { clientId, seatToken } };
  },
  lastRoomSet(code: string | null, startedAt: number | null): RuntimeAction {
    return { type: "RUNTIME_LAST_ROOM_SET", payload: { code, startedAt } };
  },
  roomStateReceived(room: RoomState, you: RuntimeYouState | null): RuntimeAction {
    return { type: "RUNTIME_ROOM_STATE_RECEIVED", payload: { room, you } };
  },
  roomCleared(): RuntimeAction {
    return { type: "RUNTIME_ROOM_CLEARED" };
  }
};

export type RuntimeDispatch = (action: RuntimeAction) => void;
