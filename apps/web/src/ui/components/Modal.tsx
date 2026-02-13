import type { PropsWithChildren } from "react";

export interface ModalProps extends PropsWithChildren {
  id: string;
  titleId: string;
  title: string;
}

export function Modal({ id, titleId, title, children }: ModalProps) {
  return (
    <div id={id} className="modal hidden" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-backdrop" data-close-settings="true" />
      <div className="modal-content">
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button id="close-settings" className="ghost" type="button" aria-label="Close settings">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
