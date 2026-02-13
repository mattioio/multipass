import { useSyncExternalStore } from "react";

export function useLegacyStore<TState = unknown>() {
  const subscribe = (onChange: () => void) => {
    const store = window.__multipassStore;
    if (!store) {
      return () => {};
    }
    return store.subscribe(() => onChange());
  };

  const getSnapshot = () => {
    const store = window.__multipassStore;
    if (!store) return null as TState | null;
    return store.getState() as TState;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
