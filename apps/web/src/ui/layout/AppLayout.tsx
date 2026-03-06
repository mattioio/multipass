import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useRuntime } from "../../app/runtime";
import { copyRoomInviteLink } from "../../legacy/shareLink.js";
import { useAppRouter } from "../routing/AppRouter";
import { ActionToast, AppActionDock, AppShell, Button, Modal, Toast } from "../components";

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
  const { state, setSettingsOpen } = useRuntime();
  const { route, goTo } = useAppRouter();
  const isReactRuntime = state.runtimeMode === "react";
  const [shareLabel, setShareLabel] = useState("Share");
  const [shareBusy, setShareBusy] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>("light");

  const openSettings = isReactRuntime ? () => setSettingsOpen(true) : undefined;
  const closeSettings = isReactRuntime ? () => setSettingsOpen(false) : undefined;
  const showHeroRoom = useMemo(() => {
    if (!isReactRuntime) return false;
    if (state.mode !== "online") return false;
    if (!state.room?.code) return false;
    return route.screen === "lobby" || route.screen === "wait" || route.screen === "winner";
  }, [isReactRuntime, route.screen, state.mode, state.room?.code]);

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

  useEffect(() => {
    if (!isReactRuntime || !state.settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isReactRuntime, state.settingsOpen, setSettingsOpen]);

  useEffect(() => {
    if (!isReactRuntime) return;

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
  }, [isReactRuntime]);

  useEffect(() => {
    if (!isReactRuntime) return;
    document.body.dataset.mode = uiMode;
    document.body.dataset.uiVariant = uiMode === "dark" ? "neon_night" : "soft";
  }, [isReactRuntime, uiMode]);

  const handleModeToggle = useCallback((checked: boolean) => {
    if (!isReactRuntime) return;
    const nextMode: UiMode = checked ? "dark" : "light";
    setUiMode(nextMode);
    try {
      window.localStorage.setItem(UI_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Ignore persistence failures.
    }
  }, [isReactRuntime]);

  return (
    <>
      <AppShell
        onOpenSettings={openSettings}
        roomCode={state.room?.code ?? null}
        showRoomCode={showHeroRoom}
        shareLabel={shareLabel}
        onShareRoom={handleShareRoom}
        shareDisabled={shareBusy || !state.room?.code}
      >
        {children}
      </AppShell>
      <AppActionDock />

      <Toast />
      <ActionToast />

      <Modal
        id="settings-modal"
        titleId="settings-title"
        title="Settings"
        open={isReactRuntime ? state.settingsOpen : undefined}
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
                checked={isReactRuntime ? uiMode === "dark" : undefined}
                onChange={isReactRuntime
                  ? (event) => handleModeToggle(event.currentTarget.checked)
                  : undefined}
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
              onClick={isReactRuntime ? () => {
                setSettingsOpen(false);
                goTo("devkit");
              } : undefined}
            >
              Open component kitchen sink
            </Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
