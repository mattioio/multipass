import { renderHook } from "@testing-library/react";
import { useJoinFlow } from "../useJoinFlow";

describe("useJoinFlow", () => {
  it("normalizes and validates room codes", () => {
    const { result } = renderHook(() => useJoinFlow(" fv3j "));
    expect(result.current.normalizedCode).toBe("FVJ");
    expect(result.current.canValidate).toBe(false);
  });

  it("marks valid 4-letter code as ready", () => {
    const { result } = renderHook(() => useJoinFlow("abcd"));
    expect(result.current.normalizedCode).toBe("ABCD");
    expect(result.current.canValidate).toBe(true);
  });
});
