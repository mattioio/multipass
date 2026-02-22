import {
  confirmLocalHandoff,
  createInitialLocalPrivacyState,
  queueLocalHandoff,
  shouldShowLocalPassScreen
} from "../localPrivacy.js";

describe("local hidden-info privacy flow", () => {
  it("moves to handoff stage after a turn passes to a different viewer", () => {
    const initial = createInitialLocalPrivacyState("p1");
    const next = queueLocalHandoff(initial, {
      nextViewerPlayerId: "p2",
      prompt: "Pass now to Player 2."
    });

    expect(next.stage).toBe("handoff");
    expect(next.pendingViewerPlayerId).toBe("p2");
    expect(next.viewerPlayerId).toBe("p1");
  });

  it("returns to visible stage and swaps viewer on confirm", () => {
    const handoff = {
      ...createInitialLocalPrivacyState("p1"),
      stage: "handoff",
      pendingViewerPlayerId: "p2",
      prompt: "Pass now to Player 2."
    };

    const confirmed = confirmLocalHandoff(handoff);
    expect(confirmed.stage).toBe("visible");
    expect(confirmed.viewerPlayerId).toBe("p2");
    expect(confirmed.pendingViewerPlayerId).toBeNull();
    expect(confirmed.prompt).toBe("");
  });

  it("keeps visible stage when next viewer is unchanged", () => {
    const initial = createInitialLocalPrivacyState("p1");
    const next = queueLocalHandoff(initial, {
      nextViewerPlayerId: "p1",
      prompt: "ignored"
    });

    expect(next.stage).toBe("visible");
    expect(next.pendingViewerPlayerId).toBeNull();
  });

  it("shows pass screen only while game is active and handoff is pending", () => {
    const room = { game: { state: { winnerId: null, draw: false } } };
    const handoff = {
      ...createInitialLocalPrivacyState("p1"),
      stage: "handoff",
      pendingViewerPlayerId: "p2"
    };
    expect(shouldShowLocalPassScreen(room, handoff)).toBe(true);

    const finishedRoom = { game: { state: { winnerId: "p1", draw: false } } };
    expect(shouldShowLocalPassScreen(finishedRoom, handoff)).toBe(false);
    expect(shouldShowLocalPassScreen(room, createInitialLocalPrivacyState("p1"))).toBe(false);
  });
});
