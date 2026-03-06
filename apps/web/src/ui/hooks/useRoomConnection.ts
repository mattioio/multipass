import { useRuntime } from "../../app/runtime";

export function useRoomConnection() {
  const { state } = useRuntime();

  return {
    status: state.connectionStatus,
    roomCode: state.room?.code ?? null,
    role: state.you?.role ?? null,
    playerId: state.you?.playerId ?? null
  };
}
