import type { ScreenKey } from "../../types";

const ROOM_REQUIRED_SCREENS = new Set<ScreenKey>(["lobby", "pick", "wait", "game", "pass", "winner"]);

export interface NormalizeScreenState {
  hasRoom: boolean;
  hasGame: boolean;
  hasEndedGame: boolean;
  resolvedScreen: ScreenKey;
}

export function normalizeTargetScreen(target: ScreenKey | null | undefined, state: NormalizeScreenState): ScreenKey {
  if (!target) return "landing";
  if (target === "pick") return state.hasRoom ? "lobby" : "landing";
  if (ROOM_REQUIRED_SCREENS.has(target) && !state.hasRoom) return "landing";

  if (target === "game" && !state.hasGame) {
    return state.hasRoom ? state.resolvedScreen : "landing";
  }

  if (target === "winner") {
    return state.hasEndedGame ? "game" : (state.hasRoom ? state.resolvedScreen : "landing");
  }

  return target;
}
