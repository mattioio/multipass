import { render, screen } from "@testing-library/react";
import { DevKitchenScreen } from "../screens/DevKitchenScreen";

describe("registry-driven game modules", () => {
  it("renders game modules from registry in devkit", () => {
    render(<DevKitchenScreen />);

    expect(screen.getByRole("heading", { name: "Game Modules" })).toBeInTheDocument();
    expect(screen.getAllByText("Tic Tac Toe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tic Tac Toe Blitz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Battleships").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Zombie Dice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unknown game").length).toBeGreaterThan(0);
  });
});
