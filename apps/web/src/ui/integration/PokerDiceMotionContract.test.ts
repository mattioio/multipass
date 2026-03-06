import { describe, expect, it } from "vitest";
import appScreensSource from "../screens/app/AppScreens.tsx?raw";

describe("Poker Dice motion contract", () => {
  it("keeps legacy poker roll timing constants in AppScreens", () => {
    expect(appScreensSource).toContain("const POKER_DICE_ROLL_DURATION_MS = 2000;");
    expect(appScreensSource).toContain("const POKER_DICE_SHUFFLE_MIN_MS = 80;");
    expect(appScreensSource).toContain("const POKER_DICE_SHUFFLE_MAX_MS = 120;");
    expect(appScreensSource).toContain("const POKER_DICE_ROLL_SPEED_MIN_MS = 480;");
    expect(appScreensSource).toContain("const POKER_DICE_ROLL_SPEED_MAX_MS = 620;");
    expect(appScreensSource).toContain("const POKER_DICE_ROLL_DELAY_MAX_MS = 140;");
  });
});
