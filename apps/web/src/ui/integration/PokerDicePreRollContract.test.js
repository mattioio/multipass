import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import appScreensSource from "../screens/app/AppScreens.tsx?raw";

const screensCssSource = readFileSync("src/styles/screens.css", "utf8");

describe("Poker Dice pre-roll contract", () => {
  it("renders dedicated pre-roll coach markup + roll CTA state classes", () => {
    expect(appScreensSource).toContain("id=\"poker-dice-preroll-status\"");
    expect(appScreensSource).toContain("data-state={pokerPreRollCoach.mode}");
    expect(appScreensSource).toContain("is-preroll-viewer");
    expect(appScreensSource).toContain("is-preroll-cta");
  });

  it("masks dice by rendering null faces during viewer pre-roll", () => {
    expect(appScreensSource).toContain("return Array.from({ length: diceCount }, () => null);");
    expect(appScreensSource).not.toContain("getPokerInitialFaceForIndex");
    expect(appScreensSource).not.toContain("POKER_DICE_INITIAL_FACES");
  });

  it("keeps CSS contracts for pre-roll visual mask and CTA pulse", () => {
    expect(screensCssSource).toContain(".poker-dice-layout.is-preroll-viewer .poker-cube-face");
    expect(screensCssSource).toContain(".poker-dice-actions .compact-action.is-preroll-cta");
    expect(screensCssSource).toContain("@keyframes poker-roll-cta-pulse");
  });
});

