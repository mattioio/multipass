import type { PropsWithChildren } from "react";

export interface ModalProps extends PropsWithChildren {
  id: string;
  titleId: string;
  title: string;
  open?: boolean;
  onClose?: () => void;
}

export function Modal({ id, titleId, title, children, open, onClose }: ModalProps) {
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : false;
  const classes = `modal${isOpen ? "" : " hidden"}`;

  return (
    <div id={id} className={classes} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {onClose ? (
        <div
          className="modal-scrim"
          role="presentation"
          aria-hidden="true"
          onClick={onClose}
        />
      ) : (
        <div className="modal-scrim" data-close-settings="true" role="presentation" aria-hidden="true" />
      )}
      <div className="modal-content">
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            id="close-settings"
            className="ghost"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
