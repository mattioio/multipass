import { render } from "@testing-library/react";
import { App } from "../App";

describe("Turn bar state contract", () => {
  it("uses deterministic data-attribute defaults on mount", () => {
    render(<App />);

    const indicator = document.getElementById("turn-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator?.dataset.mode).toBe("idle");
    expect(indicator?.dataset.activeSide).toBe("none");
    expect(indicator?.dataset.animate).toBeUndefined();
  });

  it("does not expose legacy dock contract attributes", () => {
    render(<App />);

    expect(document.querySelector("#turn-indicator [data-role=\"active-pane\"]")).not.toBeInTheDocument();
    expect(document.querySelector("#turn-indicator [data-role=\"waiting-dock\"]")).not.toBeInTheDocument();
    expect(document.querySelector("#turn-indicator [data-compact]")).not.toBeInTheDocument();
    expect(document.querySelector("#turn-indicator .turn-player-cta")).not.toBeInTheDocument();
  });
});
