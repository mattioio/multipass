import { render } from "@testing-library/react";
import { PlayerCardShell } from "../PlayerCardShell";

describe("PlayerCardShell", () => {
  it("renders picker variant with legacy alias classes", () => {
    const { container } = render(
      <PlayerCardShell
        variant="picker"
        themeClass="theme-red"
        name="Mr Red"
        artSrc="/player.svg"
        selected
      />
    );

    expect(container.querySelector(".player-card-shell--picker.avatar-shell")).toBeInTheDocument();
    expect(container.querySelector(".player-card-inner--picker.avatar-inner")).toBeInTheDocument();
    expect(container.querySelector(".player-card-lower-third--picker.avatar-lower-third")).toBeInTheDocument();
    expect(container.querySelector(".player-card-name--picker.avatar-name")?.textContent).toBe("Mr Red");
    expect(container.querySelector(".player-card-badge--selected")).toBeInTheDocument();
    expect(container.querySelector(".player-card-badge--lock")).toBeInTheDocument();
  });

  it("renders score variant status badges", () => {
    const { container } = render(
      <PlayerCardShell
        variant="score"
        themeClass="theme-green"
        name="Mrs Green"
        artSrc="/player.svg"
        waiting
        leader
      />
    );

    expect(container.querySelector(".player-card-shell--score")).toBeInTheDocument();
    expect(container.querySelector(".player-card-art-placeholder")).toBeInTheDocument();
    expect(container.querySelector(".player-card-spinner")).toBeInTheDocument();
    expect(container.querySelector(".player-card-badge--leader")?.textContent).toBe("Leader");
    expect(container.querySelector(".avatar-lower-third")).not.toBeInTheDocument();
  });
});
