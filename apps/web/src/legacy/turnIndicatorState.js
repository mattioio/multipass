function resolveSideByPlayerId({ activePlayerId, hostPlayerId, guestPlayerId }) {
  if (!activePlayerId) return null;
  if (hostPlayerId && activePlayerId === hostPlayerId) return "host";
  if (guestPlayerId && activePlayerId === guestPlayerId) return "guest";
  return null;
}

export function resolveTurnIndicatorVisualState({
  mode = "turn",
  activePlayerId = null,
  hostPlayerId = null,
  guestPlayerId = null
} = {}) {
  const resolvedMode = ["turn", "winner", "draw", "idle"].includes(mode) ? mode : "idle";
  const resolvedSide = resolveSideByPlayerId({
    activePlayerId,
    hostPlayerId,
    guestPlayerId
  });
  const activeSide = (resolvedMode === "turn" || resolvedMode === "winner") ? resolvedSide : null;

  return {
    mode: resolvedMode,
    activeSide
  };
}
