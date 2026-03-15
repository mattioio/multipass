import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import appScreensSource from "../screens/app/AppScreens.tsx?raw";
import gameSectionSource from "../screens/app/GameSection.tsx?raw";
import pokerDiceHookSource from "../screens/app/usePokerDiceGame.ts?raw";

const combinedSource = appScreensSource + "\n" + gameSectionSource;
const screensCssSource = readFileSync("src/styles/screens.css", "utf8");

describe("Poker Dice pre-roll contract", () => {
  it("renders dedicated pre-roll coach markup + roll CTA state classes", () => {
    expect(combinedSource).toContain("id=\"poker-dice-preroll-status\"");
    expect(combinedSource).toContain("data-state={pokerPreRollCoach.mode}");
    expect(combinedSource).toContain("is-preroll-viewer");
    expect(combinedSource).toContain("is-preroll-cta");
  });

  it("masks dice by rendering null faces during viewer pre-roll", () => {
    expect(pokerDiceHookSource).toContain("return Array.from({ length: diceCount }, () => null);");
    expect(pokerDiceHookSource).not.toContain("getPokerInitialFaceForIndex");
    expect(pokerDiceHookSource).not.toContain("POKER_DICE_INITIAL_FACES");
  });

  it("keeps CSS contracts for pre-roll visual mask and CTA pulse", () => {
    expect(screensCssSource).toContain(".poker-dice-layout.is-preroll-viewer .poker-cube-face");
    expect(screensCssSource).toContain(".poker-dice-actions .compact-action.is-preroll-cta");
    expect(screensCssSource).toContain("@keyframes poker-roll-cta-pulse");
  });
});

