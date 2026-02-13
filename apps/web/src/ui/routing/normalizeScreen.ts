import type { ScreenKey } from "../../types";

const ROOM_REQUIRED_SCREENS = new Set<ScreenKey>(["lobby", "pick", "wait", "game", "shuffle", "winner"]);

export interface NormalizeScreenState {
  hasRoom: boolean;
  hasGame: boolean;
  isShuffling: boolean;
  hasEndedGame: boolean;
  resolvedScreen: ScreenKey;
}

export function normalizeTargetScreen(target: ScreenKey | null | undefined, state: NormalizeScreenState): ScreenKey {
  if (!target) return "landing";
  if (ROOM_REQUIRED_SCREENS.has(target) && !state.hasRoom) return "landing";

  if (target === "game" && (!state.hasGame || state.isShuffling)) {
    return state.hasRoom ? state.resolvedScreen : "landing";
  }

  if (target === "winner") {
    return state.hasEndedGame ? "winner" : (state.hasRoom ? state.resolvedScreen : "landing");
  }

  if (target === "shuffle" && !state.isShuffling) {
    return state.hasRoom ? state.resolvedScreen : "landing";
  }

  return target;
}
