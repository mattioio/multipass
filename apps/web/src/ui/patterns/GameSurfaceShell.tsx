import type { PropsWithChildren, ReactNode } from "react";

export interface GameSurfaceShellProps extends PropsWithChildren {
  title?: string;
  status?: string;
  state?: "idle" | "active" | "disabled" | "waiting" | "error" | "complete";
  showHead?: boolean;
  actions?: ReactNode;
}

export function GameSurfaceShell({
  title = "Game",
  status = "Ready",
  state = "idle",
  showHead = true,
  actions = null,
  children
}: GameSurfaceShellProps) {
  return (
    <div className={`game-panel game-surface-shell state-${state}`}>
      {showHead ? (
        <div className="game-surface-head">
          <h2 className="game-surface-title">{title}</h2>
          <span className={`game-chip game-surface-status state-${state}`}>{status}</span>
        </div>
      ) : null}
      <div className="game-surface-body">{children}</div>
      {actions ? <div className="game-surface-actions">{actions}</div> : null}
    </div>
  );
}
