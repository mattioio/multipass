import { describe, expect, it } from "vitest";
import {
  getJoinCodeErrorStatusMessage,
  isAvatarRequiredError,
  isRoomFullError,
  isRoomNotFoundError,
  parseServerMessage
} from "../protocolAdapter";

describe("parseServerMessage", () => {
  it("parses session messages", () => {
    const parsed = parseServerMessage({ type: "session", clientId: "client_1", seatToken: "seat_1" });
    expect(parsed.kind).toBe("session");
  });

  it("returns unknown for invalid shapes", () => {
    const parsed = parseServerMessage({ type: "session" });
    expect(parsed.kind).toBe("unknown");
  });
});

describe("error helpers", () => {
  it("supports code-based error matching", () => {
    const roomNotFound = { type: "error", code: "ROOM_NOT_FOUND", message: "any" } as const;
    const roomFull = { type: "error", code: "ROOM_FULL", message: "any" } as const;
    const avatarRequired = { type: "error", code: "AVATAR_REQUIRED", message: "any" } as const;

    expect(isRoomNotFoundError(roomNotFound)).toBe(true);
    expect(isRoomFullError(roomFull)).toBe(true);
    expect(isAvatarRequiredError(avatarRequired)).toBe(true);
  });

  it("maps join-code status message from server errors", () => {
    expect(getJoinCodeErrorStatusMessage({ type: "error", code: "ROOM_NOT_FOUND", message: "Room not found." })).toBe("Room not found");
    expect(getJoinCodeErrorStatusMessage({ type: "error", code: "ROOM_FULL", message: "Room is full." })).toBe("Room is full");
    expect(getJoinCodeErrorStatusMessage({ type: "error", message: "Something else" })).toBe("Couldn't verify room");
  });
});
