import { render } from "@testing-library/react";
import { App } from "../App";

describe("registry-driven game modules", () => {
  it("renders dots board shell in the app and omits the old status card", () => {
    render(<App />);

    expect(document.getElementById("dots-layout")).toBeInTheDocument();
    expect(document.getElementById("dots-board")).toBeInTheDocument();
    expect(document.getElementById("dots-status")).toBeNull();
    expect(document.getElementById("dots-turn-hint")).toBeNull();
    expect(document.getElementById("dots-progress")).toBeNull();
    expect(document.getElementById("dots-score-row")).toBeNull();
    expect(document.getElementById("dots-score-host")).toBeNull();
    expect(document.getElementById("dots-score-guest")).toBeNull();
    expect(document.getElementById("unsupported-game-layout")).toBeInTheDocument();
    expect(document.getElementById("unsupported-game-title")).toBeInTheDocument();
    expect(document.getElementById("unsupported-game-message")).toBeInTheDocument();
  });
});
