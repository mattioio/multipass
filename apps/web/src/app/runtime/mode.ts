// Runtime mode is always "react". Legacy runtime has been removed.
// This module is kept for backward compatibility with any code that
// reads the storage key, but resolveRuntimeMode always returns "react".

export const RUNTIME_MODE_STORAGE_KEY = "multipass_runtime_mode";

export function resolveRuntimeMode(): "react" {
  return "react";
}

export function readRuntimeModeOverride(): "react" | null {
  return null;
}

export function writeRuntimeModeOverride(): void {}

export function clearRuntimeModeOverride(): void {}
