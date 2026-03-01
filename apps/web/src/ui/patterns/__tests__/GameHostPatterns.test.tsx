import { render, screen } from "@testing-library/react";
import { Button } from "../../components";
import { GameActionRow, GameSurfaceShell, ResultBanner, TurnStatusBar } from "../index";

describe("game host patterns", () => {
  it("renders shell state and status with actions", () => {
    render(
      <div className="game-screen-layout">
        <GameSurfaceShell
          title="Tic Tac Toe"
          status="Waiting"
          state="waiting"
          actions={(
            <GameActionRow>
              <Button type="button">Primary</Button>
            </GameActionRow>
          )}
        />
        <div className="game-turn-footer">
          <TurnStatusBar id="turn-indicator-test" />
        </div>
      </div>
    );

    expect(screen.getByText("Tic Tac Toe")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Primary" })).toBeInTheDocument();
    expect(document.querySelector(".game-turn-footer #turn-indicator-test")).toBeInTheDocument();
    expect(document.querySelector(".game-surface-strip #turn-indicator-test")).not.toBeInTheDocument();
    expect(document.getElementById("turn-indicator-test")).toBeInTheDocument();
  });

  it("renders result banner", () => {
    render(<ResultBanner title="Winner" />);

    expect(screen.getByRole("heading", { name: "Winner" })).toBeInTheDocument();
  });

  it("can hide shell head while preserving body and actions", () => {
    render(
      <GameSurfaceShell
        title="Hidden Title"
        status="Hidden Status"
        showHead={false}
        actions={(
          <GameActionRow>
            <Button type="button">Primary</Button>
          </GameActionRow>
        )}
      >
        <TurnStatusBar id="turn-indicator-test-hidden-head" />
      </GameSurfaceShell>
    );

    expect(document.querySelector(".game-surface-head")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden Title")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden Status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Primary" })).toBeInTheDocument();
    expect(document.getElementById("turn-indicator-test-hidden-head")).toBeInTheDocument();
  });
});
