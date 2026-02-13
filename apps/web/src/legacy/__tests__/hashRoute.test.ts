import { normalizeRoomCode, parseScreenRoute } from "../hashRoute.js";

describe("hash route parser", () => {
  const hashToScreen = {
    "#join": "join",
    "#host": "host"
  };

  it("normalizes room codes", () => {
    expect(normalizeRoomCode(" fv3j ")).toBe("FVJ");
    expect(normalizeRoomCode("abCd")).toBe("ABCD");
  });

  it("parses #join without a code", () => {
    expect(parseScreenRoute("#join", hashToScreen)).toEqual({
      screen: "join",
      joinCode: null
    });
  });

  it("parses #join=CODE with normalized 4-letter code", () => {
    expect(parseScreenRoute("#join=fvbj", hashToScreen)).toEqual({
      screen: "join",
      joinCode: "FVBJ"
    });
  });

  it("keeps join route with invalid code format", () => {
    expect(parseScreenRoute("#join=12", hashToScreen)).toEqual({
      screen: "join",
      joinCode: null
    });
  });

  it("parses non-join hashes via map", () => {
    expect(parseScreenRoute("#host", hashToScreen)).toEqual({
      screen: "host",
      joinCode: null
    });
  });

  it("supports legacy #landing route without requiring map entry", () => {
    expect(parseScreenRoute("#landing", hashToScreen)).toEqual({
      screen: "landing",
      joinCode: null
    });
  });

  it("returns null screen for unknown hashes", () => {
    expect(parseScreenRoute("#unknown", hashToScreen)).toEqual({
      screen: null,
      joinCode: null
    });
  });
});
