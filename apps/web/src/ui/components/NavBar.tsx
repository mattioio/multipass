import type { ReactNode } from "react";

export interface NavBarAction {
  /** Accessible label */
  label: string;
  /** Click handler */
  onClick?: () => void;
  /** Optional icon (rendered before label) */
  icon?: ReactNode;
  /** Whether to show the text label alongside icon */
  showLabel?: boolean;
  /** Additional className */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export interface NavBarProps {
  /** Left slot — button or null for empty space */
  left?: NavBarAction | null;
  /** Center slot — logo image, title text, or custom ReactNode */
  center?: ReactNode;
  /** Right slot — button or null for empty space */
  right?: NavBarAction | null;
  /** Extra content below the nav row (e.g., room code) */
  below?: ReactNode;
  /** Additional className on the header */
  className?: string;
}

export function NavBar({ left, center, right, below, className = "" }: NavBarProps) {
  return (
    <header className={`nav-bar ${className}`.trim()}>
      <div className="nav-bar-row">
        <div className="nav-bar-left">
          {left ? (
            <button
              type="button"
              className={`ghost nav-bar-action ${left.className ?? ""}`.trim()}
              onClick={left.onClick}
              disabled={left.disabled}
              aria-label={left.label}
            >
              {left.icon}
              {(left.showLabel !== false) && (
                <span className="nav-bar-action-label">{left.label}</span>
              )}
            </button>
          ) : null}
        </div>

        <div className="nav-bar-center">
          {center}
        </div>

        <div className="nav-bar-right">
          {right ? (
            <button
              type="button"
              className={`ghost nav-bar-action ${right.className ?? ""}`.trim()}
              onClick={right.onClick}
              disabled={right.disabled}
              aria-label={right.label}
            >
              {right.icon}
              {(right.showLabel !== false) && (
                <span className="nav-bar-action-label">{right.label}</span>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {below && <div className="nav-bar-below">{below}</div>}
    </header>
  );
}

/* ── Reusable icon components ─────────────────────── */

export function HomeIcon() {
  return (
    <svg className="nav-bar-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.4 3 11v9.2c0 .2.2.4.4.4h6.2a.4.4 0 0 0 .4-.4v-5.6h4v5.6c0 .2.2.4.4.4h6.2c.2 0 .4-.2.4-.4V11z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg className="nav-bar-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg className="nav-bar-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19.14 12.94a7.6 7.6 0 0 0 .05-.94a7.6 7.6 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.6 7.6 0 0 0-.05.94c0 .32.02.63.05.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.58-.22 1.13-.54 1.63-.94l2.39.96c.24.1.51.01.64-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
        fill="currentColor"
      />
    </svg>
  );
}
