import { render } from "@testing-library/react";
import { App } from "../App";

describe("Game screen turn footer integration", () => {
  it("mounts the turn indicator in the top sticky game footer region", () => {
    render(<App />);

    const gameScreen = document.getElementById("screen-game");
    const indicator = gameScreen?.querySelector(".game-turn-footer #turn-indicator") as HTMLElement | null;
    expect(indicator).toBeInTheDocument();
    expect(indicator?.dataset.mode).toBe("idle");
    expect(indicator?.dataset.activeSide).toBe("none");
    expect(indicator?.dataset.animate).toBeUndefined();
    expect(indicator?.querySelector('[data-role="active-pane"]')).not.toBeInTheDocument();
    expect(indicator?.querySelector('[data-role="waiting-dock"]')).not.toBeInTheDocument();
    expect(indicator?.querySelector("[data-compact]")).not.toBeInTheDocument();
    expect(gameScreen?.querySelector(".game-screen-layout > .game-turn-footer + .game-panel.game-surface-shell")).toBeInTheDocument();
    expect(gameScreen?.querySelector(".game-surface-strip #turn-indicator")).not.toBeInTheDocument();
    expect(gameScreen?.querySelector("#game-close-board")).toBeInTheDocument();
  });
});
