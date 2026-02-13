import type { PatternKey } from "../../types/PatternKey";

type PatternInput = PatternKey | "veritcal";
type PatternSurfaceKey = "avatar" | "score" | "turn" | "header";

export interface SurfacePatternConfig {
  pattern?: PatternInput;
  size?: string;
  opacity?: number;
  animated?: boolean;
  speed?: string;
}

export interface PatternConfig extends SurfacePatternConfig {
  surfaces?: Partial<Record<PatternSurfaceKey, SurfacePatternConfig>>;
}

const SURFACES: PatternSurfaceKey[] = ["avatar", "score", "turn", "header"];
const PATTERN_KEY_ALIASES: Record<string, PatternKey> = {
  dots: "dots",
  diagonal: "diagonal",
  zig: "zig",
  vertical: "vertical",
  veritcal: "vertical"
};
const PATTERN_VAR_BY_KEY: Record<PatternKey, string> = {
  dots: "var(--pattern-image-dots)",
  diagonal: "var(--pattern-image-diagonal)",
  zig: "var(--pattern-image-zig)",
  vertical: "var(--pattern-image-vertical)"
};

interface PatternVariableNames {
  pattern: string;
  size: string;
  opacity: string;
  animated: string;
  speed: string;
}

const GLOBAL_VARS = {
  pattern: "--pattern-image-override",
  size: "--pattern-size-override",
  opacity: "--pattern-opacity-override",
  animated: "--pattern-animated",
  speed: "--pattern-speed-override"
} as const satisfies PatternVariableNames;

const SURFACE_VARS: Record<PatternSurfaceKey, PatternVariableNames> = {
  avatar: {
    pattern: "--pattern-image-override-avatar",
    size: "--pattern-size-override-avatar",
    opacity: "--pattern-opacity-override-avatar",
    animated: "--pattern-animated-avatar",
    speed: "--pattern-speed-override-avatar"
  },
  score: {
    pattern: "--pattern-image-override-score",
    size: "--pattern-size-override-score",
    opacity: "--pattern-opacity-override-score",
    animated: "--pattern-animated-score",
    speed: "--pattern-speed-override-score"
  },
  turn: {
    pattern: "--pattern-image-override-turn",
    size: "--pattern-size-override-turn",
    opacity: "--pattern-opacity-override-turn",
    animated: "--pattern-animated-turn",
    speed: "--pattern-speed-override-turn"
  },
  header: {
    pattern: "--pattern-image-override-header",
    size: "--pattern-size-override-header",
    opacity: "--pattern-opacity-override-header",
    animated: "--pattern-animated-header",
    speed: "--pattern-speed-override-header"
  }
};

function getBodyStyle(): CSSStyleDeclaration | null {
  if (typeof document === "undefined" || !document.body) return null;
  return document.body.style;
}

function hasOwn<T extends object, K extends PropertyKey>(obj: T, key: K): obj is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizePatternKey(value: unknown): PatternKey | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PATTERN_KEY_ALIASES[normalized] || null;
}

function parsePatternVariable(value: string): PatternKey | undefined {
  const match = value.match(/--pattern-image-(dots|diagonal|zig|vertical)/);
  if (!match) return undefined;
  return PATTERN_KEY_ALIASES[match[1]];
}

function setOrClear(style: CSSStyleDeclaration, variableName: string, value: string | undefined) {
  if (!value) {
    style.removeProperty(variableName);
    return;
  }
  style.setProperty(variableName, value);
}

function normalizeCssString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOpacity(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.min(1, Math.max(0, value));
  return String(clamped);
}

function normalizeAnimated(value: unknown): string | undefined {
  if (typeof value !== "boolean") return undefined;
  return value ? "running" : "paused";
}

function applyScopeConfig(
  style: CSSStyleDeclaration,
  variables: PatternVariableNames,
  config: SurfacePatternConfig
) {
  if (hasOwn(config, "pattern")) {
    const normalizedPattern = normalizePatternKey(config.pattern);
    setOrClear(style, variables.pattern, normalizedPattern ? PATTERN_VAR_BY_KEY[normalizedPattern] : undefined);
  }
  if (hasOwn(config, "size")) {
    setOrClear(style, variables.size, normalizeCssString(config.size));
  }
  if (hasOwn(config, "opacity")) {
    setOrClear(style, variables.opacity, normalizeOpacity(config.opacity));
  }
  if (hasOwn(config, "animated")) {
    setOrClear(style, variables.animated, normalizeAnimated(config.animated));
  }
  if (hasOwn(config, "speed")) {
    setOrClear(style, variables.speed, normalizeCssString(config.speed));
  }
}

function readScopeConfig(style: CSSStyleDeclaration, variables: PatternVariableNames): SurfacePatternConfig {
  const config: SurfacePatternConfig = {};
  const patternValue = style.getPropertyValue(variables.pattern).trim();
  const sizeValue = style.getPropertyValue(variables.size).trim();
  const opacityValue = style.getPropertyValue(variables.opacity).trim();
  const animatedValue = style.getPropertyValue(variables.animated).trim();
  const speedValue = style.getPropertyValue(variables.speed).trim();

  const parsedPattern = parsePatternVariable(patternValue);
  if (parsedPattern) {
    config.pattern = parsedPattern;
  }
  if (sizeValue) {
    config.size = sizeValue;
  }
  if (opacityValue) {
    const parsedOpacity = Number(opacityValue);
    if (Number.isFinite(parsedOpacity)) {
      config.opacity = parsedOpacity;
    }
  }
  if (animatedValue === "running") {
    config.animated = true;
  } else if (animatedValue === "paused") {
    config.animated = false;
  }
  if (speedValue) {
    config.speed = speedValue;
  }

  return config;
}

function hasValues(config: SurfacePatternConfig): boolean {
  return Boolean(
    config.pattern !== undefined ||
      config.size !== undefined ||
      config.opacity !== undefined ||
      config.animated !== undefined ||
      config.speed !== undefined
  );
}

export function setPatternConfig(config: PatternConfig): void {
  const style = getBodyStyle();
  if (!style || !config || typeof config !== "object") return;

  applyScopeConfig(style, GLOBAL_VARS, config);

  if (!config.surfaces || typeof config.surfaces !== "object") return;
  for (const surface of SURFACES) {
    const surfaceConfig = config.surfaces[surface];
    if (!surfaceConfig || typeof surfaceConfig !== "object") continue;
    applyScopeConfig(style, SURFACE_VARS[surface], surfaceConfig);
  }
}

export function resetPatternConfig(): void {
  const style = getBodyStyle();
  if (!style) return;

  for (const variableName of Object.values(GLOBAL_VARS)) {
    style.removeProperty(variableName);
  }

  for (const surface of SURFACES) {
    for (const variableName of Object.values(SURFACE_VARS[surface])) {
      style.removeProperty(variableName);
    }
  }
}

export function getPatternConfig(): PatternConfig {
  const style = getBodyStyle();
  if (!style) return {};

  const config: PatternConfig = readScopeConfig(style, GLOBAL_VARS);
  const surfaceConfig: NonNullable<PatternConfig["surfaces"]> = {};

  for (const surface of SURFACES) {
    const parsed = readScopeConfig(style, SURFACE_VARS[surface]);
    if (hasValues(parsed)) {
      surfaceConfig[surface] = parsed;
    }
  }

  if (Object.keys(surfaceConfig).length > 0) {
    config.surfaces = surfaceConfig;
  }

  return config;
}
