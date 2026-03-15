import {
  classifySwipeAxis,
  computeSwipeVelocityPxPerMs,
  hasMetDragActivation,
  resolveLandingSnapMode,
  shouldSuppressClick
} from "../gestures.js";

describe("gesture helpers", () => {
  it("applies drag activation threshold", () => {
    expect(hasMetDragActivation(4, 3, 8)).toBe(false);
    expect(hasMetDragActivation(8, 0, 8)).toBe(true);
    expect(hasMetDragActivation(6, 6, 8)).toBe(true);
  });

  it("classifies axis using ratio bias", () => {
    expect(classifySwipeAxis(40, 10)).toBe("horizontal");
    expect(classifySwipeAxis(8, 18)).toBe("vertical");
    expect(classifySwipeAxis(10, 10, 1.3)).toBe("none");
  });

  it("computes velocity in px/ms safely", () => {
    expect(computeSwipeVelocityPxPerMs(120, 300)).toBeCloseTo(0.4, 5);
    expect(computeSwipeVelocityPxPerMs(120, 0)).toBe(0);
  });

  it("snaps landing by distance or velocity thresholds", () => {
    expect(
      resolveLandingSnapMode({
        startMode: "local",
        deltaX: -80,
        velocityX: -0.1,
        distanceThresholdPx: 60,
        velocityThresholdPxPerMs: 0.4
      })
    ).toBe("online");

    expect(
      resolveLandingSnapMode({
        startMode: "local",
        deltaX: -20,
        velocityX: -0.45,
        distanceThresholdPx: 60,
        velocityThresholdPxPerMs: 0.4
      })
    ).toBe("online");

    expect(
      resolveLandingSnapMode({
        startMode: "online",
        deltaX: -20,
        velocityX: -0.1,
        distanceThresholdPx: 60,
        velocityThresholdPxPerMs: 0.4
      })
    ).toBe("online");
  });

  it("suppresses synthetic click for a short period", () => {
    expect(shouldSuppressClick(1000, 900)).toBe(true);
    expect(shouldSuppressClick(1000, 1000)).toBe(true);
    expect(shouldSuppressClick(1000, 1200, 250)).toBe(true);
    expect(shouldSuppressClick(1000, 1300, 250)).toBe(false);
  });
});
