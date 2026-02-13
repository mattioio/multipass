import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App local setup integration", () => {
  it("renders local setup picker controls in the React tree", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByText("Player 1 choice")).toBeInTheDocument();

    const localGrid = document.getElementById("local-fruit-grid");
    expect(localGrid).toBeInTheDocument();
    expect(localGrid?.querySelectorAll(".fruit-option").length).toBe(4);
  });
});
