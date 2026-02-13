import { useMemo } from "react";
import type { AppUiState } from "../../types";
import { useLegacyStore } from "../../state/useLegacyStore";
import { useAppRouter } from "../routing/AppRouter";

interface LegacyUiSnapshot {
  ws: WebSocket | null;
  room: { code?: string; game?: { id?: string } | null } | null;
}

function resolveConnectionStatus(ws: WebSocket | null): AppUiState["connectionStatus"] {
  if (!ws) return "disconnected";
  if (ws.readyState === WebSocket.OPEN) return "connected";
  if (ws.readyState === WebSocket.CONNECTING) return "connecting";
  return "disconnected";
}

export function useAppUiState(): AppUiState {
  const { route } = useAppRouter();
  const snapshot = useLegacyStore<LegacyUiSnapshot>();

  return useMemo(() => {
    const settingsEl = document.getElementById("settings-modal");
    const isSettingsOpen = Boolean(settingsEl && !settingsEl.classList.contains("hidden"));

    return {
      activeScreen: route.screen,
      hasRoom: Boolean(snapshot?.room),
      roomCode: snapshot?.room?.code ?? null,
      connectionStatus: resolveConnectionStatus(snapshot?.ws ?? null),
      currentGameId: snapshot?.room?.game?.id ?? null,
      isSettingsOpen
    };
  }, [route.screen, snapshot?.room, snapshot?.ws]);
}
