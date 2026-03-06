import { runtimeActions } from "../actions";
import { runtimeReducer } from "../reducer";
import { createInitialRuntimeState } from "../state";

describe("runtime reducer", () => {
  it("stores session identifiers and room payloads", () => {
    const initial = createInitialRuntimeState("react");
    const withSession = runtimeReducer(initial, runtimeActions.sessionReceived("client_1", "seat_1"));
    expect(withSession.clientId).toBe("client_1");
    expect(withSession.seatToken).toBe("seat_1");

    const withRoom = runtimeReducer(withSession, runtimeActions.roomStateReceived({
      code: "ABCD",
      createdAt: 1,
      updatedAt: 1,
      players: { host: null, guest: null },
      round: null,
      game: null
    }, {
      clientId: "client_1",
      playerId: "p1",
      role: "host",
      roomCode: "ABCD"
    }));

    expect(withRoom.room?.code).toBe("ABCD");
    expect(withRoom.you?.role).toBe("host");
    expect(withRoom.lastRoomCode).toBe("ABCD");
  });

  it("tracks join validation lifecycle", () => {
    const initial = createInitialRuntimeState("react");
    const validating = runtimeReducer(initial, runtimeActions.joinValidating());
    expect(validating.join.status).toBe("validating");

    const ready = runtimeReducer(validating, runtimeActions.joinReady({ code: "WXYZ" }, "ok"));
    expect(ready.join.status).toBe("ready");
    expect(ready.join.preview?.code).toBe("WXYZ");

    const errored = runtimeReducer(ready, runtimeActions.joinError("Room not found"));
    expect(errored.join.status).toBe("error");
    expect(errored.join.message).toBe("Room not found");
    expect(errored.join.preview).toBeNull();
  });

  it("resets join preview state when code changes", () => {
    const initial = createInitialRuntimeState("react");
    const ready = runtimeReducer(initial, runtimeActions.joinReady({ code: "ABCD" }, "ok"));
    const edited = runtimeReducer(ready, runtimeActions.joinCodeSet("WXYZ"));

    expect(edited.join.code).toBe("WXYZ");
    expect(edited.join.status).toBe("idle");
    expect(edited.join.message).toBe("");
    expect(edited.join.preview).toBeNull();
  });

  it("stores and clears last-room metadata", () => {
    const initial = createInitialRuntimeState("react");
    const remembered = runtimeReducer(initial, runtimeActions.lastRoomSet("ROOM", 12345));
    expect(remembered.lastRoomCode).toBe("ROOM");
    expect(remembered.lastRoomStartedAt).toBe(12345);

    const cleared = runtimeReducer(remembered, runtimeActions.lastRoomSet(null, null));
    expect(cleared.lastRoomCode).toBeNull();
    expect(cleared.lastRoomStartedAt).toBeNull();
  });
});
