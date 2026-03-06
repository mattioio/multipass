import {
  clearRuntimeModeOverride,
  readRuntimeModeOverride,
  resolveRuntimeMode,
  writeRuntimeModeOverride
} from "../mode";

function createMockStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    }
  };
}

describe("runtime mode resolution", () => {
  it("defaults to react", () => {
    const storage = createMockStorage();
    expect(resolveRuntimeMode({ storage, envValue: undefined })).toBe("react");
  });

  it("uses env value when storage override is absent", () => {
    const storage = createMockStorage();
    expect(resolveRuntimeMode({ storage, envValue: "legacy" })).toBe("legacy");
    expect(resolveRuntimeMode({ storage, envValue: "react" })).toBe("react");
  });

  it("gives storage override highest priority", () => {
    const storage = createMockStorage();
    writeRuntimeModeOverride("legacy", storage);
    expect(resolveRuntimeMode({ storage, envValue: "react" })).toBe("legacy");
    writeRuntimeModeOverride("react", storage);
    expect(resolveRuntimeMode({ storage, envValue: "legacy" })).toBe("react");
  });

  it("reads, writes, and clears storage override safely", () => {
    const storage = createMockStorage();
    expect(readRuntimeModeOverride(storage)).toBeNull();
    writeRuntimeModeOverride("legacy", storage);
    expect(readRuntimeModeOverride(storage)).toBe("legacy");
    clearRuntimeModeOverride(storage);
    expect(readRuntimeModeOverride(storage)).toBeNull();
  });
});
