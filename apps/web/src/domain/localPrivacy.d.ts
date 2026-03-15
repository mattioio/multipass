import type { RoomState } from "../types";

export interface LocalPrivacyState {
  viewerPlayerId: string | null;
  pendingViewerPlayerId: string | null;
  stage: "visible" | "handoff";
  prompt: string;
}

export function createInitialLocalPrivacyState(viewerPlayerId?: string | null): LocalPrivacyState;

export function queueLocalHandoff(
  localPrivacy: LocalPrivacyState,
  options: {
    nextViewerPlayerId: string | null;
    prompt?: string;
  }
): LocalPrivacyState;

export function confirmLocalHandoff(localPrivacy: LocalPrivacyState): LocalPrivacyState;

export function shouldShowLocalPassScreen(room: RoomState | null, localPrivacy: LocalPrivacyState): boolean;
