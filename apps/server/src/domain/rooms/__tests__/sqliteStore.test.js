import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSqliteRoomStore } from "../sqliteStore.js";

describe("createSqliteRoomStore", () => {
  let store;

  beforeEach(() => {
    store = createSqliteRoomStore({ dbPath: ":memory:" });
  });

  afterEach(() => {
    store.close();
  });

  it("starts empty", () => {
    expect(store.size()).toBe(0);
  });

  it("returns null for missing room", () => {
    expect(store.getRoom("ZZZZ")).toBeNull();
  });

  it("hasRoom returns false for missing room", () => {
    expect(store.hasRoom("ZZZZ")).toBe(false);
  });

  it("stores and retrieves a room", () => {
    const room = { code: "ABCD", players: [], state: "lobby" };
    store.setRoom("ABCD", room);

    expect(store.hasRoom("ABCD")).toBe(true);
    expect(store.getRoom("ABCD")).toEqual(room);
    expect(store.size()).toBe(1);
  });

  it("overwrites an existing room", () => {
    store.setRoom("ABCD", { version: 1 });
    store.setRoom("ABCD", { version: 2 });

    expect(store.getRoom("ABCD")).toEqual({ version: 2 });
    expect(store.size()).toBe(1);
  });

  it("deletes a room", () => {
    store.setRoom("ABCD", { code: "ABCD" });
    store.deleteRoom("ABCD");

    expect(store.hasRoom("ABCD")).toBe(false);
    expect(store.getRoom("ABCD")).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("delete on missing room is a no-op", () => {
    store.deleteRoom("NOPE");
    expect(store.size()).toBe(0);
  });

  it("entries iterates all rooms", () => {
    store.setRoom("AAAA", { id: 1 });
    store.setRoom("BBBB", { id: 2 });
    store.setRoom("CCCC", { id: 3 });

    const result = new Map(store.entries());
    expect(result.size).toBe(3);
    expect(result.get("AAAA")).toEqual({ id: 1 });
    expect(result.get("BBBB")).toEqual({ id: 2 });
    expect(result.get("CCCC")).toEqual({ id: 3 });
  });

  it("preserves complex nested objects through JSON round-trip", () => {
    const room = {
      code: "TEST",
      players: [{ id: "p1", name: "Alice", scores: [10, 20] }],
      game: { type: "ticTacToe", board: [null, "x", "o", null, null, null, null, null, null] }
    };
    store.setRoom("TEST", room);
    expect(store.getRoom("TEST")).toEqual(room);
  });

  describe("pruneStale", () => {
    it("removes rooms older than the cutoff", () => {
      const realNow = Date.now;

      // Insert a room "in the past"
      Date.now = () => 1000;
      store.setRoom("OLD1", { old: true });

      // Insert a room "now"
      Date.now = () => 100_000;
      store.setRoom("NEW1", { old: false });

      // Prune anything older than 50 seconds (cutoff = 100000 - 50000 = 50000)
      const removed = store.pruneStale(50_000);

      Date.now = realNow;

      expect(removed).toBe(1);
      expect(store.hasRoom("OLD1")).toBe(false);
      expect(store.hasRoom("NEW1")).toBe(true);
      expect(store.size()).toBe(1);
    });
  });
});
