import type { RuntimeState } from "../../types";
import type { RuntimeAction } from "./actions";

export function runtimeReducer(state: RuntimeState, action: RuntimeAction): RuntimeState {
  switch (action.type) {
    case "RUNTIME_WS_SET":
      return {
        ...state,
        ws: action.payload.ws
      };
    case "RUNTIME_CONNECTION_STATUS_SET":
      return {
        ...state,
        connectionStatus: action.payload.status
      };
    case "RUNTIME_MODE_SET":
      return {
        ...state,
        mode: action.payload.mode
      };
    case "RUNTIME_JOIN_CODE_SET":
      return {
        ...state,
        join: {
          ...state.join,
          code: action.payload.code,
          status: "idle",
          message: "",
          preview: null
        }
      };
    case "RUNTIME_JOIN_VALIDATING":
      return {
        ...state,
        join: {
          ...state.join,
          status: "validating",
          message: "",
          preview: null
        }
      };
    case "RUNTIME_JOIN_READY":
      return {
        ...state,
        join: {
          ...state.join,
          status: "ready",
          message: action.payload.message || "",
          preview: action.payload.preview
        }
      };
    case "RUNTIME_JOIN_ERROR":
      return {
        ...state,
        join: {
          ...state.join,
          status: "error",
          message: action.payload.message,
          preview: null
        }
      };
    case "RUNTIME_SESSION_RECEIVED":
      return {
        ...state,
        clientId: action.payload.clientId,
        seatToken: action.payload.seatToken ?? state.seatToken
      };
    case "RUNTIME_LAST_ROOM_SET":
      return {
        ...state,
        lastRoomCode: action.payload.code,
        lastRoomStartedAt: action.payload.startedAt
      };
    case "RUNTIME_ROOM_STATE_RECEIVED":
      return {
        ...state,
        room: action.payload.room,
        you: action.payload.you,
        lastRoomCode: action.payload.room.code || state.lastRoomCode,
        lastRoomStartedAt: Number(action.payload.room.createdAt || Date.now())
      };
    case "RUNTIME_ROOM_CLEARED":
      return {
        ...state,
        room: null,
        you: null
      };
    default:
      return state;
  }
}
