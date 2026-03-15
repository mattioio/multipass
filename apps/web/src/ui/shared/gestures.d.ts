export const DEFAULT_DRAG_ACTIVATION_PX: number;
export const DEFAULT_AXIS_RATIO: number;
export const DEFAULT_SWIPE_DISTANCE_PX: number;
export const DEFAULT_SWIPE_VELOCITY_PX_PER_MS: number;
export const DEFAULT_CLICK_SUPPRESSION_MS: number;

export function clamp(value: number, min: number, max: number): number;

export function hasMetDragActivation(
  deltaX: number,
  deltaY: number,
  activationPx?: number
): boolean;

export function classifySwipeAxis(
  deltaX: number,
  deltaY: number,
  axisRatio?: number
): "horizontal" | "vertical" | "none";

export function computeSwipeVelocityPxPerMs(distancePx: number, elapsedMs: number): number;

export function resolveLandingSnapMode(options?: {
  startMode?: "local" | "online";
  deltaX?: number;
  velocityX?: number;
  distanceThresholdPx?: number;
  velocityThresholdPxPerMs?: number;
}): "local" | "online";

export function shouldSuppressClick(
  suppressUntilTs: number,
  nowTs?: number,
  suppressionWindowMs?: number
): boolean;
