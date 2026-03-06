import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import appScreensSource from "../screens/app/AppScreens.tsx?raw";

const screensCssSource = readFileSync("src/styles/screens.css", "utf8");

describe("Poker Dice visual contract", () => {
  it("uses a single cube element path and no rotor wrapper", () => {
    expect(appScreensSource).toContain("className={`poker-cube${Number.isInteger(dieValue) ? ` show-${dieValue}` : \"\"}`}");
    expect(appScreensSource).not.toContain("poker-cube-rotor");
  });

  it("keeps resolved show transforms face-forward without tilt offsets", () => {
    expect(screensCssSource).toContain(".poker-cube.show-1 {\n  transform: rotateX(0deg) rotateY(0deg);");
    expect(screensCssSource).toContain(".poker-cube.show-2 {\n  transform: rotateX(0deg) rotateY(-90deg);");
    expect(screensCssSource).toContain(".poker-cube.show-3 {\n  transform: rotateX(0deg) rotateY(-180deg);");
    expect(screensCssSource).toContain(".poker-cube.show-4 {\n  transform: rotateX(0deg) rotateY(90deg);");
    expect(screensCssSource).toContain(".poker-cube.show-5 {\n  transform: rotateX(-90deg) rotateY(0deg);");
    expect(screensCssSource).toContain(".poker-cube.show-6 {\n  transform: rotateX(90deg) rotateY(0deg);");
    expect(screensCssSource).not.toContain("rotateX(-22deg) rotateY(-66deg)");
    expect(screensCssSource).not.toContain("rotateX(-112deg) rotateY(24deg)");
  });
});
