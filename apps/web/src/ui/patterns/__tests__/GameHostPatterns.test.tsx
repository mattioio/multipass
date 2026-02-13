import { render, screen } from "@testing-library/react";
import { Button } from "../../components";
import { GameActionRow, GameSurfaceShell, ResultBanner, TurnStatusBar } from "../index";

describe("game host patterns", () => {
  it("renders shell state and status with actions", () => {
    render(
      <GameSurfaceShell
        title="Tic Tac Toe"
        status="Waiting"
        state="waiting"
        actions={(
          <GameActionRow>
            <Button type="button">Primary</Button>
          </GameActionRow>
        )}
      >
        <TurnStatusBar id="turn-indicator-test" />
      </GameSurfaceShell>
    );

    expect(screen.getByText("Tic Tac Toe")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Primary" })).toBeInTheDocument();
    expect(document.getElementById("turn-indicator-test")).toBeInTheDocument();
  });

  it("renders result banner", () => {
    render(<ResultBanner emoji="🎉" title="Winner" />);

    expect(screen.getByText("🎉")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Winner" })).toBeInTheDocument();
  });
});
