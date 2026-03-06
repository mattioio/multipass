import type { RuntimeConnectionStatus, RuntimeState } from "../../types";

export function selectConnectionStatus(state: RuntimeState): RuntimeConnectionStatus {
  if (state.connectionStatus !== "disconnected") {
    return state.connectionStatus;
  }
  const socket = state.ws;
  if (!socket) return "disconnected";
  if (socket.readyState === WebSocket.OPEN) return "connected";
  if (socket.readyState === WebSocket.CONNECTING) return "connecting";
  return "disconnected";
}

export function selectHasRoom(state: RuntimeState): boolean {
  return Boolean(state.room?.code);
}

export function selectCurrentGameId(state: RuntimeState): string | null {
  return state.room?.game?.id ?? null;
}
