import { render } from "@testing-library/react";
import { App } from "../App";

describe("App inline CTA layout", () => {
  it("uses homepage launcher actions with sheet screens and a hidden app dock shell", () => {
    render(<App />);

    const dock = document.getElementById("app-fixed-footer");
    expect(dock).toBeInTheDocument();
    expect(dock).toHaveClass("hidden");
    expect(document.getElementById("go-local")).toBeInTheDocument();
    expect(document.getElementById("go-online")).toBeInTheDocument();
    expect(document.getElementById("screen-online")).toBeInTheDocument();

    expect(document.getElementById("local-continue")).toBeInTheDocument();
    expect(document.getElementById("create-room")).toBeInTheDocument();
    expect(document.getElementById("join-room")).toBeInTheDocument();
    expect(document.getElementById("game-list")).toBeInTheDocument();
    expect(document.getElementById("pick-status")).toBeInTheDocument();
  });
});
