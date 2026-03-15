export const DEFAULT_DRAG_ACTIVATION_PX = 12;
export const DEFAULT_AXIS_RATIO = 1.15;
export const DEFAULT_SWIPE_DISTANCE_PX = 56;
export const DEFAULT_SWIPE_VELOCITY_PX_PER_MS = 0.42;
export const DEFAULT_CLICK_SUPPRESSION_MS = 380;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function hasMetDragActivation(deltaX, deltaY, activationPx = DEFAULT_DRAG_ACTIVATION_PX) {
  return Math.hypot(deltaX, deltaY) >= Math.max(0, activationPx);
}

export function classifySwipeAxis(deltaX, deltaY, axisRatio = DEFAULT_AXIS_RATIO) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const ratio = Math.max(1, axisRatio);

  if (absX === 0 && absY === 0) return "none";
  if (absX >= absY * ratio) return "horizontal";
  if (absY >= absX * ratio) return "vertical";
  return "none";
}

export function computeSwipeVelocityPxPerMs(distancePx, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return distancePx / elapsedMs;
}

export function resolveLandingSnapMode(options = {}) {
  const startMode = options.startMode === "online" ? "online" : "local";
  const deltaX = Number(options.deltaX) || 0;
  const velocityX = Number(options.velocityX) || 0;
  const distanceThresholdPx = Math.max(0, Number(options.distanceThresholdPx) || DEFAULT_SWIPE_DISTANCE_PX);
  const velocityThresholdPxPerMs = Math.max(
    0,
    Number(options.velocityThresholdPxPerMs) || DEFAULT_SWIPE_VELOCITY_PX_PER_MS
  );

  if (Math.abs(deltaX) < distanceThresholdPx && Math.abs(velocityX) < velocityThresholdPxPerMs) {
    return startMode;
  }
  return deltaX < 0 ? "online" : "local";
}

export function shouldSuppressClick(
  suppressUntilTs,
  nowTs = Date.now(),
  suppressionWindowMs = DEFAULT_CLICK_SUPPRESSION_MS
) {
  if (!Number.isFinite(suppressUntilTs) || suppressUntilTs <= 0) return false;
  if (!Number.isFinite(nowTs)) return false;
  if (nowTs <= suppressUntilTs) return true;
  return nowTs - suppressUntilTs <= Math.max(0, suppressionWindowMs);
}
