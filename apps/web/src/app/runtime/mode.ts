import type { RuntimeMode } from "../../types";

export const RUNTIME_MODE_STORAGE_KEY = "multipass_runtime_mode";

function normalizeRuntimeMode(value: unknown): RuntimeMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "react") return "react";
  if (normalized === "legacy") return "legacy";
  return null;
}

export function readRuntimeModeOverride(storage: Storage | null = null): RuntimeMode | null {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return null;
  try {
    return normalizeRuntimeMode(target.getItem(RUNTIME_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function resolveRuntimeMode(options: {
  storage?: Storage | null;
  envValue?: unknown;
} = {}): RuntimeMode {
  const override = readRuntimeModeOverride(options.storage ?? null);
  if (override) return override;
  const envMode = normalizeRuntimeMode(options.envValue ?? import.meta.env.VITE_RUNTIME_MODE);
  if (envMode) return envMode;
  return "react";
}

export function writeRuntimeModeOverride(
  mode: RuntimeMode,
  storage: Storage | null = null
): void {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return;
  try {
    target.setItem(RUNTIME_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore persistence failures (private mode / storage restrictions).
  }
}

export function clearRuntimeModeOverride(storage: Storage | null = null): void {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return;
  try {
    target.removeItem(RUNTIME_MODE_STORAGE_KEY);
  } catch {
    // Ignore persistence failures (private mode / storage restrictions).
  }
}
