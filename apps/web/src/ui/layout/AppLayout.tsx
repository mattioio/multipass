import { useCallback, useMemo, useState, type PropsWithChildren, type ReactNode } from "react";
import { useRuntime } from "../../app/runtime";
import { copyRoomInviteLink } from "../../net/shareLink.js";
import { useAppRouter } from "../routing/AppRouter";
import { AppShell, NavBar, HomeIcon, Toast, ActionToast } from "../components";
import { RoomCodeShareRow } from "../patterns/RoomCodeShareRow";
import { SETUP_SHEET_SCREENS } from "../screens/app/appScreensUtils";
import multipassLogo from "../../assets/multipass-logo.svg";

export function AppLayout({ children }: PropsWithChildren) {
  const { state, setMode, send, connect, disconnect } = useRuntime();
  const { route, goTo } = useAppRouter();
  const [shareLabel, setShareLabel] = useState("Share");
  const [shareBusy, setShareBusy] = useState(false);

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
      return null;
    }

    return (
      <NavBar
        className={isLobby ? "nav-bar--lobby" : ""}
        left={isLobby ? { label: "Home", icon: <HomeIcon />, onClick: handleGoHome } : null}
        center={logo}
        right={null}
        below={roomCodeBelow}
      />
    );
  }, [screen, showHeroRoom, state.room?.code, shareLabel, shareBusy, handleShareRoom, handleGoHome, handleBackToLobby]);

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
    </>
  );
}
