import type { PropsWithChildren } from "react";

export interface AppShellProps extends PropsWithChildren {}

export function AppShell({ children }: AppShellProps) {
  const isDevBuild = import.meta.env.DEV;

  return (
    <div id="app">
      {isDevBuild ? <div id="dev-build-tag">dev build</div> : null}
      <header className="hero">
        <div className="hero-top">
          <button id="hero-left-action" className="ghost hero-action hidden" type="button">
            Back
          </button>
          <div className="logo">
            <img className="logo-image" src="/src/assets/multipass-logo.svg" alt="Multipass" />
          </div>
          <button id="open-settings" className="ghost hero-action" type="button" aria-label="Open settings">
            <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94a7.6 7.6 0 0 0 .05-.94a7.6 7.6 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.6 7.6 0 0 0-.05.94c0 .32.02.63.05.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.58-.22 1.13-.54 1.63-.94l2.39.96c.24.1.51.01.64-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <div id="hero-room" className="hero-room hidden">
          <div className="hero-room-main">
            <div id="room-code-pill" className="code-pill">
              <span id="room-code" className="code-hero">----</span>
            </div>
            <button id="share-room-link" className="ghost hero-share-action" type="button">
              Share
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
