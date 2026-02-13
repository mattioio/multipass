import { useEffect, useRef } from "react";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function SettingsModal({ open, onClose, returnFocusTo = null }: SettingsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    returnFocusTo?.focus();
  }, [open, returnFocusTo]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <button className="modal-backdrop" type="button" aria-label="Close settings" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-head">
          <h2 id="settings-modal-title">Settings</h2>
          <button ref={closeButtonRef} className="ghost" type="button" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="setting-row">
          <span>Day / Night mode</span>
        </div>
      </div>
    </div>
  );
}
