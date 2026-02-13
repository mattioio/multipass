import { act, renderHook } from "@testing-library/react";
import { useHashRouting } from "../useHashRouting";

describe("useHashRouting", () => {
  it("maps empty hash to landing", () => {
    window.history.replaceState({}, "", "/");
    const { result } = renderHook(() => useHashRouting());
    expect(result.current.route.screen).toBe("landing");
  });

  it("normalizes legacy #landing to clean root", async () => {
    window.history.replaceState({}, "", "/#landing");
    renderHook(() => useHashRouting());

    await act(async () => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(window.location.hash).toBe("");
  });

  it("parses #join=CODE into join route", () => {
    window.history.replaceState({}, "", "/#join=FVBJ");
    const { result } = renderHook(() => useHashRouting());
    expect(result.current.route.screen).toBe("join");
    expect(result.current.route.join.code).toBe("FVBJ");
  });
});
