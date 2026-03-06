import type { RuntimeMode, RuntimeState } from "../../types";
import { loadRuntimePersistence } from "./persistence";

export function createInitialRuntimeState(runtimeMode: RuntimeMode): RuntimeState {
  const persisted = loadRuntimePersistence();
  return {
    runtimeMode,
    mode: "online",
    ws: null,
    connectionStatus: "disconnected",
    room: null,
    you: null,
    clientId: persisted.clientId,
    seatToken: persisted.seatToken,
    lastRoomCode: persisted.lastRoomCode,
    lastRoomStartedAt: persisted.lastRoomStartedAt,
    join: {
      code: "",
      status: "idle",
      message: "",
      preview: null
    },
    settingsOpen: false
  };
}
