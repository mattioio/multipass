import { render } from "@testing-library/react";
import { AvatarTile } from "../components/AvatarTile";
import { PLAYER_CARD_VARIANTS } from "../shared/playerCardContract";
import { createPlayerCardElement } from "../shared/playerCardDom";

describe("Player card parity", () => {
  it("uses shared player-card shell classes in picker and scoreboard", () => {
    const { container } = render(
      <AvatarTile avatarId="yellow" label="Mr Yellow" themeClass="theme-yellow" selected />
    );

    expect(container.querySelector(".player-card-shell--picker")).toBeInTheDocument();

    const scoreCard = createPlayerCardElement(
      {
        id: "p1",
        name: "Mr Yellow",
        roleLabel: "Host",
        theme: "yellow",
        artSrc: "/player.svg",
        isLeader: true
      },
      { variant: PLAYER_CARD_VARIANTS.score }
    );

    document.body.appendChild(scoreCard);
    expect(document.querySelector(".player-card-shell--score")).toBeInTheDocument();
    expect(document.querySelector(".score-emoji")).not.toBeInTheDocument();
    scoreCard.remove();
  });
});
