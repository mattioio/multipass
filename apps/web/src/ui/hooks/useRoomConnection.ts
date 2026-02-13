import { useMemo } from "react";
import { useLegacyStore } from "../../state/useLegacyStore";

interface LegacyStateSnapshot {
  ws: WebSocket | null;
  room: { code?: string } | null;
  you: { playerId?: string; role?: string } | null;
}

export function useRoomConnection() {
  const snapshot = useLegacyStore<LegacyStateSnapshot>();

  const status = useMemo(() => {
    const ws = snapshot?.ws;
    if (!ws) return "disconnected" as const;
    if (ws.readyState === WebSocket.OPEN) return "connected" as const;
    if (ws.readyState === WebSocket.CONNECTING) return "connecting" as const;
    return "disconnected" as const;
  }, [snapshot?.ws]);

  return {
    status,
    roomCode: snapshot?.room?.code ?? null,
    role: snapshot?.you?.role ?? null,
    playerId: snapshot?.you?.playerId ?? null
  };
}
