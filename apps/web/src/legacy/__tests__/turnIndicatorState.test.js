import { resolveTurnIndicatorVisualState } from "../turnIndicatorState.js";

describe("resolveTurnIndicatorVisualState", () => {
  const base = {
    mode: "turn",
    hostPlayerId: "host-1",
    guestPlayerId: "guest-1"
  };

  it("resolves host as active side for host turns", () => {
    const result = resolveTurnIndicatorVisualState({
      ...base,
      activePlayerId: "host-1"
    });

    expect(result).toEqual({
      mode: "turn",
      activeSide: "host"
    });
  });

  it("resolves guest as active side for guest turns", () => {
    const result = resolveTurnIndicatorVisualState({
      ...base,
      activePlayerId: "guest-1"
    });

    expect(result).toEqual({
      mode: "turn",
      activeSide: "guest"
    });
  });

  it("keeps winner mode and resolves winner side", () => {
    const result = resolveTurnIndicatorVisualState({
      ...base,
      mode: "winner",
      activePlayerId: "guest-1"
    });

    expect(result).toEqual({
      mode: "winner",
      activeSide: "guest"
    });
  });

  it("clears active side in draw mode", () => {
    const result = resolveTurnIndicatorVisualState({
      ...base,
      mode: "draw",
      activePlayerId: "host-1"
    });

    expect(result).toEqual({
      mode: "draw",
      activeSide: null
    });
  });

  it("falls back to idle for unknown mode", () => {
    const result = resolveTurnIndicatorVisualState({
      ...base,
      mode: "invalid",
      activePlayerId: "host-1"
    });

    expect(result).toEqual({
      mode: "idle",
      activeSide: null
    });
  });
});
