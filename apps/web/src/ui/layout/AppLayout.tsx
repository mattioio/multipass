import { useCallback, useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from "react";
import { useRuntime } from "../../app/runtime";
import { copyRoomInviteLink } from "../../net/shareLink.js";
import { useAppRouter } from "../routing/AppRouter";
import { ActionToast, AppShell, NavBar, HomeIcon, BackIcon, SettingsIcon, Button, Modal, Toast } from "../components";
import { RoomCodeShareRow } from "../patterns/RoomCodeShareRow";
import { SETUP_SHEET_SCREENS } from "../screens/app/appScreensUtils";
import multipassLogo from "../../assets/multipass-logo.svg";

export interface AppLayoutProps extends PropsWithChildren {
  isDevBuild: boolean;
}

const UI_MODE_STORAGE_KEY = "multipass_mode";

type UiMode = "light" | "dark";

function normalizeUiMode(rawValue: unknown): UiMode | null {
  if (typeof rawValue !== "string") return null;
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "light" || normalized === "dark") {
    return normalized;
  }
  return null;
}

export function AppLayout({ children, isDevBuild }: AppLayoutProps) {
  const { state, setSettingsOpen, setMode, send, connect, disconnect } = useRuntime();
  const { route, goTo } = useAppRouter();
  const [shareLabel, setShareLabel] = useState("Share");
  const [shareBusy, setShareBusy] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>("light");

  const openSettings = () => setSettingsOpen(true);
  const closeSettings = () => setSettingsOpen(false);

  const screen = route.screen;
  const isLocalMode = state.mode === "local";

  const showHeroRoom = useMemo(() => {
    if (state.mode !== "online") return false;
    if (!state.room?.code) return false;
    return screen === "lobby" || screen === "wait" || screen === "winner";
  }, [screen, state.mode, state.room?.code]);

  const handleShareRoom = useCallback(async () => {
    if (!state.room?.code || shareBusy) return;
    setShareBusy(true);
    const result = await copyRoomInviteLink({
      roomCode: state.room.code,
      currentHref: window.location.href
    });
    setShareLabel(result.ok ? "Copied" : "Retry");
    window.setTimeout(() => {
      setShareLabel("Share");
    }, 1400);
    setShareBusy(false);
  }, [shareBusy, state.room?.code]);

  const handleGoHome = useCallback(() => {
    if (isLocalMode) {
      setMode("online");
      goTo("landing", { replace: false });
      return;
    }
    send({ type: "leave_room" });
    goTo("landing", { replace: false });
  }, [isLocalMode, setMode, send, goTo]);

  const handleBackToLobby = useCallback(() => {
    goTo("lobby", { replace: false });
  }, [goTo]);

  /* ── Nav configuration per screen ───────────────── */
  const nav = useMemo((): ReactNode => {
    const isLanding = screen === "landing" || SETUP_SHEET_SCREENS.has(screen);
    const isLobby = screen === "lobby";
    const isGame = screen === "game";

    const showNav = isLanding || isLobby || isGame;
    if (!showNav) return null;

    const logo = (
      <img
        className="logo-image"
        src={multipassLogo}
        alt="Multipass"
        style={isLobby || isGame ? { display: "none" } : undefined}
      />
    );

    const roomCodeBelow = showHeroRoom ? (
      <RoomCodeShareRow
        roomCodeValue={state.room?.code || "----"}
        shareLabel={shareLabel}
        onShare={handleShareRoom}
        shareDisabled={shareBusy || !state.room?.code}
      />
    ) : undefined;

    if (isGame) {
      return (
        <NavBar
          className="nav-bar--game"
          left={{ label: "Back", icon: <BackIcon />, onClick: handleBackToLobby }}
          center={null}
          right={{ label: "Settings", icon: <SettingsIcon />, showLabel: false, onClick: openSettings }}
        />
      );
    }

    return (
      <NavBar
        className={isLobby ? "nav-bar--lobby" : ""}
        left={isLobby ? { label: "Home", icon: <HomeIcon />, onClick: handleGoHome } : null}
        center={logo}
        right={{ label: "Settings", icon: <SettingsIcon />, showLabel: false, onClick: openSettings }}
        below={roomCodeBelow}
      />
    );
  }, [screen, showHeroRoom, state.room?.code, shareLabel, shareBusy, handleShareRoom, handleGoHome, handleBackToLobby, openSettings]);

  useEffect(() => {
    if (!state.settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [state.settingsOpen, setSettingsOpen]);

  useEffect(() => {
    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const storedMode = (() => {
      try {
        return normalizeUiMode(window.localStorage.getItem(UI_MODE_STORAGE_KEY));
      } catch {
        return null;
      }
    })();

    setUiMode(storedMode ?? (media?.matches ? "dark" : "light"));

    const onMediaChange = (event: MediaQueryListEvent) => {
      try {
        if (normalizeUiMode(window.localStorage.getItem(UI_MODE_STORAGE_KEY))) return;
      } catch {
        // Ignore storage read failures.
      }
      setUiMode(event.matches ? "dark" : "light");
    };

    media?.addEventListener("change", onMediaChange);
    return () => {
      media?.removeEventListener("change", onMediaChange);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.mode = uiMode;
    document.body.dataset.uiVariant = uiMode === "dark" ? "neon_night" : "soft";
  }, [uiMode]);

  const handleModeToggle = useCallback((checked: boolean) => {
    const nextMode: UiMode = checked ? "dark" : "light";
    setUiMode(nextMode);
    try {
      window.localStorage.setItem(UI_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Ignore persistence failures.
    }
  }, []);

  return (
    <>
      <AppShell nav={nav}>
        {children}
      </AppShell>
      {(state.connectionStatus === "reconnecting" || state.connectionStatus === "disconnected") && state.mode === "online" && (
        <div
          className="connection-banner"
          role="status"
          aria-live="polite"
          data-status={state.connectionStatus}
        >
          <span className="connection-banner-text">
            {state.connectionStatus === "reconnecting"
              ? "Connection lost. Reconnecting\u2026"
              : "Connection lost."}
          </span>
          {state.connectionStatus === "disconnected" && (
            <button
              type="button"
              className="connection-banner-action"
              onClick={() => {
                disconnect();
                connect();
              }}
            >
              Reconnect
            </button>
          )}
        </div>
      )}
      <Toast />
      <ActionToast />

      <Modal
        id="settings-modal"
        titleId="settings-title"
        title="Settings"
        open={state.settingsOpen}
        onClose={closeSettings}
      >
        <div className="setting-row">
          <span>Day / Night mode</span>
          <div className="mode-toggle" aria-label="Toggle light and dark mode">
            <span className="mode-icon" aria-hidden="true">Day</span>
            <label className="switch">
              <input
                id="mode-toggle"
                type="checkbox"
                checked={uiMode === "dark"}
                onChange={(event) => handleModeToggle(event.currentTarget.checked)}
              />
              <span className="slider"></span>
            </label>
            <span className="mode-icon" aria-hidden="true">Night</span>
          </div>
        </div>
        {isDevBuild ? (
          <div className="setting-row">
            <span>Developer tools</span>
            <Button
              id="open-devkit"
              variant="ghost"
              onClick={() => {
                setSettingsOpen(false);
                goTo("devkit");
              }}
            >
              Open component kitchen sink
            </Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
