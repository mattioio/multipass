import { render, screen } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("applies variant classes", () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="ghost">Ghost</Button>
      </>
    );

    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("glow-button");
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass("ghost");
  });

  it("keeps accessibility attributes", () => {
    render(
      <Button aria-label="Open room settings" variant="small">
        Open
      </Button>
    );

    expect(screen.getByRole("button", { name: "Open room settings" })).toHaveClass("small");
  });
});
