import { render } from "@testing-library/react";
import { App } from "../App";

describe("Game screen turn footer integration", () => {
  it("mounts the turn indicator in the game footer instead of the shell top strip", () => {
    render(<App />);

    const gameScreen = document.getElementById("screen-game");
    expect(gameScreen?.querySelector(".game-turn-footer #turn-indicator")).toBeInTheDocument();
    expect(gameScreen?.querySelector(".game-surface-strip #turn-indicator")).not.toBeInTheDocument();
  });
});
