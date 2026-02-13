/// <reference types="vite/client" />

interface LegacyStore<TState = unknown> {
  getState: () => TState;
  subscribe: (listener: (state: TState, action: unknown) => void) => () => void;
}

declare global {
  interface Window {
    __multipassStore?: LegacyStore;
    __multipassLegacyInitialized?: boolean;
    __multipassLegacyBootstrapped?: boolean;
  }
}

export {};
