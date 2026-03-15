export function createInitialLocalPrivacyState(viewerPlayerId = null) {
  return {
    viewerPlayerId,
    pendingViewerPlayerId: null,
    stage: "visible",
    prompt: ""
  };
}

export function queueLocalHandoff(localPrivacy, { nextViewerPlayerId, prompt }) {
  if (!nextViewerPlayerId) {
    return {
      ...localPrivacy,
      pendingViewerPlayerId: null,
      stage: "visible",
      prompt: ""
    };
  }

  if (nextViewerPlayerId === localPrivacy.viewerPlayerId) {
    return {
      ...localPrivacy,
      pendingViewerPlayerId: null,
      stage: "visible",
      prompt: ""
    };
  }

  return {
    ...localPrivacy,
    pendingViewerPlayerId: nextViewerPlayerId,
    stage: "handoff",
    prompt: prompt || ""
  };
}

export function confirmLocalHandoff(localPrivacy) {
  const nextViewer = localPrivacy.pendingViewerPlayerId || localPrivacy.viewerPlayerId || null;
  return {
    ...localPrivacy,
    viewerPlayerId: nextViewer,
    pendingViewerPlayerId: null,
    stage: "visible",
    prompt: ""
  };
}

export function shouldShowLocalPassScreen(room, localPrivacy) {
  if (!room?.game) return false;
  if (room.game.state?.winnerId || room.game.state?.draw) return false;
  return localPrivacy.stage === "handoff";
}
