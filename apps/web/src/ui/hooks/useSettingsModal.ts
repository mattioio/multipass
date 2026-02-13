import { useCallback, useRef, useState } from "react";

export function useSettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openSettings = useCallback((focusTarget?: HTMLElement | null) => {
    returnFocusRef.current = focusTarget ?? null;
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
    returnFocusRef.current?.focus();
  }, []);

  return {
    isOpen,
    openSettings,
    closeSettings,
    returnFocusRef
  };
}
