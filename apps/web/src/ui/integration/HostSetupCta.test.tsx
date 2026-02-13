import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App host setup CTA integration", () => {
  it("renders host CTA in disabled pick-player state by default", () => {
    render(<App />);

    const hostCta = document.getElementById("create-room");
    expect(hostCta).toBeInTheDocument();
    expect(hostCta).toHaveTextContent("Pick a player");
    expect(hostCta).toBeDisabled();
    expect(screen.queryByText("Pick your avatar")).not.toBeInTheDocument();
  });
});
