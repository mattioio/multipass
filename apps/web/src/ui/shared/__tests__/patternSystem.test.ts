import { afterEach, describe, expect, it } from "vitest";
import { getPatternConfig, resetPatternConfig, setPatternConfig } from "../patternSystem";

describe("patternSystem", () => {
  afterEach(() => {
    resetPatternConfig();
  });

  it("sets global pattern overrides", () => {
    setPatternConfig({
      pattern: "zig",
      size: "120px auto",
      opacity: 0.4,
      animated: false,
      speed: "40s"
    });

    const style = document.body.style;
    expect(style.getPropertyValue("--pattern-image-override").trim()).toBe("var(--pattern-image-zig)");
    expect(style.getPropertyValue("--pattern-size-override").trim()).toBe("120px auto");
    expect(style.getPropertyValue("--pattern-opacity-override").trim()).toBe("0.4");
    expect(style.getPropertyValue("--pattern-animated").trim()).toBe("paused");
    expect(style.getPropertyValue("--pattern-speed-override").trim()).toBe("40s");
  });

  it("sets per-surface overrides independently", () => {
    setPatternConfig({
      surfaces: {
        avatar: { pattern: "dots", speed: "8s" },
        turn: { opacity: 0.6, animated: false }
      }
    });

    const style = document.body.style;
    expect(style.getPropertyValue("--pattern-image-override-avatar").trim()).toBe("var(--pattern-image-dots)");
    expect(style.getPropertyValue("--pattern-speed-override-avatar").trim()).toBe("8s");
    expect(style.getPropertyValue("--pattern-opacity-override-turn").trim()).toBe("0.6");
    expect(style.getPropertyValue("--pattern-animated-turn").trim()).toBe("paused");
    expect(style.getPropertyValue("--pattern-image-override-score").trim()).toBe("");
  });

  it("normalizes legacy pattern alias veritcal -> vertical", () => {
    setPatternConfig({ pattern: "veritcal" });

    const style = document.body.style;
    expect(style.getPropertyValue("--pattern-image-override").trim()).toBe("var(--pattern-image-vertical)");
    expect(getPatternConfig().pattern).toBe("vertical");
  });

  it("clamps opacity and ignores invalid values", () => {
    setPatternConfig({
      opacity: 3.2,
      size: 120 as unknown as string,
      speed: null as unknown as string,
      animated: "yes" as unknown as boolean,
      surfaces: {
        avatar: {
          pattern: "unknown" as unknown as "dots",
          opacity: -5
        }
      }
    });

    const style = document.body.style;
    expect(style.getPropertyValue("--pattern-opacity-override").trim()).toBe("1");
    expect(style.getPropertyValue("--pattern-size-override").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-speed-override").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-animated").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-image-override-avatar").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-opacity-override-avatar").trim()).toBe("0");
  });

  it("clears all known overrides", () => {
    setPatternConfig({
      pattern: "diagonal",
      speed: "20s",
      surfaces: {
        score: { pattern: "zig", size: "90px 90px", animated: true }
      }
    });

    resetPatternConfig();
    const style = document.body.style;
    expect(style.getPropertyValue("--pattern-image-override").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-speed-override").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-image-override-score").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-size-override-score").trim()).toBe("");
    expect(style.getPropertyValue("--pattern-animated-score").trim()).toBe("");
  });
});
