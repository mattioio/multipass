import { buildPlayerCardModel, getPlayerCardClassNames, PLAYER_CARD_VARIANTS } from "../playerCardContract";

describe("playerCardContract", () => {
  it("normalizes input model defaults", () => {
    expect(buildPlayerCardModel()).toEqual({
      id: "",
      name: "",
      roleLabel: "",
      theme: "",
      artSrc: "",
      isWaiting: false,
      isLeader: false,
      isLocked: false,
      isSelected: false
    });
  });

  it("returns picker classes with legacy aliases", () => {
    const classes = getPlayerCardClassNames(PLAYER_CARD_VARIANTS.picker, {
      isSelected: true,
      isLocked: true
    });

    expect(classes.shell).toContain("player-card-shell--picker");
    expect(classes.shell).toContain("avatar-shell");
    expect(classes.inner).toContain("avatar-inner");
    expect(classes.art).toContain("player-art");
    expect(classes.lowerThird).toContain("avatar-lower-third");
    expect(classes.name).toContain("avatar-name");
  });

  it("returns score classes without deprecated score-emoji selectors", () => {
    const classes = getPlayerCardClassNames(PLAYER_CARD_VARIANTS.score, {
      isWaiting: true,
      isLeader: true
    });

    expect(classes.shell).toContain("player-card-shell--score");
    expect(classes.shell).not.toContain("score-emoji");
    expect(classes.art).toContain("player-card-art-placeholder");
    expect(classes.leaderBadge).toContain("player-card-badge--leader");
  });
});
