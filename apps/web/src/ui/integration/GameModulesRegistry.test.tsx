import { render, screen } from "@testing-library/react";
import { DevKitchenScreen } from "../screens/DevKitchenScreen";
import { App } from "../App";

describe("registry-driven game modules", () => {
  it("renders game modules from registry in devkit", () => {
    render(<DevKitchenScreen />);

    expect(screen.getByRole("heading", { name: "Game Modules" })).toBeInTheDocument();
    expect(screen.getAllByText("Tic Tac Toe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dots & Boxes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Battleships").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unknown game").length).toBeGreaterThan(0);
  });

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
  });
});
