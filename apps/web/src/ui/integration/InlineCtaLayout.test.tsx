import { render } from "@testing-library/react";
import { App } from "../App";

describe("App inline CTA layout", () => {
  it("uses top landing tabs with inline CTAs and a hidden app dock shell", () => {
    render(<App />);

    const dock = document.getElementById("app-fixed-footer");
    expect(dock).toBeInTheDocument();
    expect(dock).toHaveClass("hidden");
    expect(document.getElementById("landing-tab-local")).toBeInTheDocument();
    expect(document.getElementById("landing-tab-online")).toBeInTheDocument();

    expect(document.getElementById("local-continue")).toBeInTheDocument();
    expect(document.getElementById("create-room")).toBeInTheDocument();
    expect(document.getElementById("join-room")).toBeInTheDocument();
    expect(document.getElementById("ready-cta")).toBeInTheDocument();
    expect(document.getElementById("winner-play-again")).toBeInTheDocument();
  });
});
