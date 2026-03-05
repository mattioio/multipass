import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("Homepage-first layered layout", () => {
  it("renders homepage actions and removes segmented landing tabs", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Online" })).toBeInTheDocument();
    expect(document.getElementById("landing-tab-local")).toBeNull();
    expect(document.getElementById("landing-tab-online")).toBeNull();
  });

  it("renders setup screens as sheet layers", () => {
    render(<App />);

    const localScreen = document.getElementById("screen-local");
    const onlineScreen = document.getElementById("screen-online");
    const localBackdrop = localScreen?.querySelector(".sheet-backdrop");
    expect(localScreen).toHaveClass("sheet-screen");
    expect(onlineScreen).toHaveClass("sheet-screen");
    expect(localScreen?.querySelector("[data-sheet-close='true']")).toBeInTheDocument();
    expect(localBackdrop).toBeInTheDocument();
    expect(localBackdrop?.tagName).toBe("DIV");
    expect(localScreen?.querySelector("[data-sheet-panel='true']")).toBeInTheDocument();
    expect(localScreen?.querySelector("[data-sheet-handle='true']")).toBeInTheDocument();
    expect(localScreen?.querySelector("[data-sheet-panel='true'] [data-sheet-handle='true']")).toBeNull();
    expect(localScreen?.querySelector(".setup-card-header .setup-header-close[data-sheet-close='true']")).toBeInTheDocument();
  });

  it("renders game board as a full screen view", () => {
    render(<App />);

    const gameScreen = document.getElementById("screen-game");
    expect(gameScreen).toBeInTheDocument();
    expect(gameScreen).not.toHaveClass("sheet-screen");
    expect(gameScreen?.querySelector("[data-sheet-panel='true']")).toBeNull();
  });

  it("keeps homepage chrome controls in the shell", () => {
    render(<App />);

    expect(document.getElementById("open-settings")).toBeInTheDocument();
    expect(document.getElementById("hero-left-action")).toBeInTheDocument();
    expect(document.querySelector(".logo .logo-image")).toBeInTheDocument();
    expect(document.querySelector(".logo button")).toBeNull();
  });
});
