import { fireEvent, render, screen } from "@testing-library/react";
import { DevKitchenScreen } from "../DevKitchenScreen";

describe("DevKitchenScreen", () => {
  it("renders expected showcase sections", () => {
    render(<DevKitchenScreen />);

    expect(screen.getByRole("heading", { name: "Component Kitchen Sink" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "State Knobs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buttons" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Avatar Tiles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Avatar Picker Grid" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Game Tile States" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Game Modules" })).toBeInTheDocument();
  });

  it("shows selected indicator badges when selected state is enabled", () => {
    render(<DevKitchenScreen />);

    expect(document.querySelectorAll(".avatar-selected-badge")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "selected" }));
    expect(document.querySelectorAll(".avatar-selected-badge")).toHaveLength(2);
  });
});
