import type { RuntimeState } from "../../types";
import { loadRuntimePersistence } from "./persistence";

export function createInitialRuntimeState(): RuntimeState {
  const persisted = loadRuntimePersistence();
  return {
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
