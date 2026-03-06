import type { PropsWithChildren } from "react";
import multipassLogo from "../../assets/multipass-logo.svg";
import { RoomCodeShareRow } from "../patterns/RoomCodeShareRow";

export interface AppShellProps extends PropsWithChildren {
  onOpenSettings?: () => void;
  roomCode?: string | null;
  showRoomCode?: boolean;
  shareLabel?: string;
  onShareRoom?: () => void;
  shareDisabled?: boolean;
}

export function AppShell({
  children,
  onOpenSettings,
  roomCode = null,
  showRoomCode = false,
  shareLabel = "Share",
  onShareRoom,
  shareDisabled = false
}: AppShellProps) {
  const isDevBuild = import.meta.env.DEV;

  return (
    <div id="app">
      {isDevBuild ? <div id="dev-build-tag">dev build</div> : null}
      <header className="hero">
        <div className="hero-top">
          <div className="hero-left-actions">
            <button id="hero-left-action" className="ghost hero-action hidden" type="button">
              Back
            </button>
            <button id="hero-left-action-2" className="ghost hero-action hidden" type="button">
              Action
            </button>
            <button id="hero-left-action-3" className="ghost hero-action hidden" type="button">
              Action
            </button>
          </div>
          <div className="logo">
            <img className="logo-image" src={multipassLogo} alt="Multipass" />
            <h2 id="lobby-games-title" className="hero-center-title hidden">Pick a game</h2>
          </div>
          <button
            id="open-settings"
            className="ghost hero-action"
            type="button"
            aria-label="Open settings"
            onClick={onOpenSettings}
          >
            <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94a7.6 7.6 0 0 0 .05-.94a7.6 7.6 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.6 7.6 0 0 0-.05.94c0 .32.02.63.05.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.58-.22 1.13-.54 1.63-.94l2.39.96c.24.1.51.01.64-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />
            </svg>
            <span id="open-settings-label" className="settings-label" aria-hidden="true"></span>
          </button>
        </div>
        <div id="hero-room" className={`hero-room${showRoomCode ? "" : " hidden"}`}>
          <RoomCodeShareRow
            roomCodeValue={roomCode || "----"}
            shareLabel={shareLabel}
            onShare={onShareRoom}
            shareDisabled={shareDisabled}
          />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
