/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_RUNTIME_MODE?: "react" | "legacy";
  readonly VITE_WS_URL?: string;
}

interface LegacyStore<TState = unknown> {
  __reactBridge?: boolean;
  getState: () => TState;
  subscribe: (listener: (state: TState, action: unknown) => void) => () => void;
}

declare global {
  interface Window {
    __multipassStore?: LegacyStore;
    __multipassLegacyReady?: boolean;
    __multipassLegacyInitialized?: boolean;
    __multipassLegacyBootstrapped?: boolean;
  }
}

export {};
