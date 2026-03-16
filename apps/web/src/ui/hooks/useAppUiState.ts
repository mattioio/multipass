import { useMemo } from "react";
import type { AppUiState } from "../../types";
import { useRuntime } from "../../app/runtime";
import { useAppRouter } from "../routing/AppRouter";

export function useAppUiState(): AppUiState {
  const { route } = useAppRouter();
  const { state } = useRuntime();

  return useMemo(() => {
    return {
      activeScreen: route.screen,
      hasRoom: Boolean(state.room),
      roomCode: state.room?.code ?? null,
      connectionStatus: state.connectionStatus,
      currentGameId: state.room?.game?.id ?? null
    };
  }, [route.screen, state.connectionStatus, state.room]);
}
