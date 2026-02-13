import { render, screen } from "@testing-library/react";
import { DevKitchenScreen } from "../DevKitchenScreen";

describe("DevKitchenScreen", () => {
  it("renders expected showcase sections", () => {
    render(<DevKitchenScreen />);

    expect(screen.getByRole("heading", { name: "Component Kitchen Sink" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buttons" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Avatar Tiles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fruit Picker Grid" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Game Tile" })).toBeInTheDocument();
  });
});
