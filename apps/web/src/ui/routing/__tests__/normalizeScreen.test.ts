import { normalizeTargetScreen } from "../normalizeScreen";

describe("normalizeTargetScreen", () => {
  const baseState = {
    hasRoom: true,
    hasGame: true,
    isShuffling: false,
    hasEndedGame: false,
    resolvedScreen: "lobby" as const
  };

  it("guards room-required routes", () => {
    expect(
      normalizeTargetScreen("pick", {
        ...baseState,
        hasRoom: false
      })
    ).toBe("landing");
  });

  it("normalizes invalid game route", () => {
    expect(
      normalizeTargetScreen("game", {
        ...baseState,
        hasGame: false,
        resolvedScreen: "lobby"
      })
    ).toBe("lobby");
  });

  it("keeps winner when game ended", () => {
    expect(
      normalizeTargetScreen("winner", {
        ...baseState,
        hasEndedGame: true
      })
    ).toBe("winner");
  });
});
