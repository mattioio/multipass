import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App dev-only affordances", () => {
  it("gates dev tag, settings entry, and devkit screen by build mode", () => {
    render(<App />);

    const devTag = document.getElementById("dev-build-tag");
    const devkitScreen = document.getElementById("screen-devkit");
    const openDevkit = screen.queryByRole("button", { name: "Open component kitchen sink" });

    if (import.meta.env.DEV) {
      expect(devTag).toBeInTheDocument();
      expect(devkitScreen).toBeInTheDocument();
      expect(openDevkit).toBeInTheDocument();
      return;
    }

    expect(devTag).not.toBeInTheDocument();
    expect(devkitScreen).not.toBeInTheDocument();
    expect(openDevkit).not.toBeInTheDocument();
  });
});
