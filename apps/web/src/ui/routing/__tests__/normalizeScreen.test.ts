import { normalizeTargetScreen } from "../normalizeScreen";

describe("normalizeTargetScreen", () => {
  const baseState = {
    hasRoom: true,
    hasGame: true,
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

  it("aliases pick route to lobby when room exists", () => {
    expect(
      normalizeTargetScreen("pick", {
        ...baseState,
        hasRoom: true
      })
    ).toBe("lobby");
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

  it("normalizes winner route to game when game ended", () => {
    expect(
      normalizeTargetScreen("winner", {
        ...baseState,
        hasEndedGame: true
      })
    ).toBe("game");
  });
});
