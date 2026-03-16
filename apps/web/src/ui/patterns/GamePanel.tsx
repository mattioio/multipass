import { useState, useEffect, useCallback } from "react";
import type { Player } from "../../types";
import {
  getPlayerArtSrc,
  getDisplayPlayerName,
  normalizeHonorific,
  getGameBannerClass,
} from "../screens/app/appScreensUtils";

export interface GamePanelProps {
  mode: "intro" | "turn" | "winner" | "draw";
  activePlayer: Player | null;
  winnerPlayer: Player | null;
  otherPlayer: Player | null;
  gameBlurb: string;
  gameName: string;
  gameId?: string | null;
  score?: number | null;
  otherPlayerScore?: number | null;
  onStart: () => void;
  onNextGame: () => void;
  onBackToLobby: () => void;
  onReturnHome: () => void;
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor" />
      <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GamePanel({
  mode,
  activePlayer,
  winnerPlayer,
  otherPlayer,
  gameBlurb,
  gameName,
  gameId = null,
  score = null,
  otherPlayerScore = null,
  onStart,
  onNextGame,
  onBackToLobby,
  onReturnHome,
}: GamePanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer when mode changes (e.g. game ends)
  useEffect(() => {
    setDrawerOpen(false);
  }, [mode]);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  if (mode === "intro") {
    const bannerClass = getGameBannerClass(gameId);
    return (
      <div className="game-info-panel" data-mode="intro">
        <div className={`game-info-panel-banner game-banner ${bannerClass}`} />
        <h3 className="game-info-panel-title">{gameName}</h3>
        <p className="game-info-panel-blurb">{gameBlurb}</p>
        <button type="button" className="ghost game-info-panel-cta" onClick={onStart}>
          Start
        </button>
      </div>
    );
  }

  if (mode === "winner" || mode === "draw") {
    const player = mode === "winner" ? winnerPlayer : null;
    const label = mode === "draw"
      ? "It's a draw!"
      : `${getDisplayPlayerName(player, "Winner")} wins!`;
    const themeClass = player?.theme ? `theme-${player.theme}` : "";

    return (
      <div className={`game-info-panel ${themeClass}`} data-mode={mode}>
        {player && (
          <span className="game-info-panel-avatar" aria-hidden="true">
            <img
              src={getPlayerArtSrc(normalizeHonorific(player.honorific))}
              alt=""
            />
          </span>
        )}
        <span className="game-info-panel-label">{label}</span>
        <button
          type="button"
          className="ghost game-info-panel-cta game-info-panel-next-cta"
          onClick={onNextGame}
        >
          Next game
        </button>
      </div>
    );
  }

  // Turn mode — with hamburger drawer
  const themeClass = activePlayer?.theme ? `theme-${activePlayer.theme}` : "";
  const turnName = getDisplayPlayerName(activePlayer, "Player");
  const otherName = getDisplayPlayerName(otherPlayer, "Opponent");
  const otherThemeClass = otherPlayer?.theme ? `theme-${otherPlayer.theme}` : "";

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="game-info-panel-backdrop is-active"
          onClick={closeDrawer}
        />
      )}

      <div
        className={`game-info-panel ${themeClass}${drawerOpen ? " is-drawer-open" : ""}`}
        data-mode="turn"
      >
        {/* Slide-up drawer content (renders above the bar) */}
        <div className="game-info-panel-drawer">
          {/* Actions first */}
          <div className="game-info-panel-drawer-actions">
            <button
              type="button"
              className="ghost game-info-panel-drawer-action"
              onClick={() => { closeDrawer(); onReturnHome(); }}
            >
              Return to hub
            </button>
            <button
              type="button"
              className="ghost game-info-panel-drawer-action is-destructive"
              onClick={() => { closeDrawer(); onBackToLobby(); }}
            >
              End game
            </button>
          </div>

          {/* Other player */}
          <div className={`game-info-panel-drawer-player ${otherThemeClass}`}>
            {otherPlayer && (
              <span className="game-info-panel-avatar" aria-hidden="true">
                <img
                  src={getPlayerArtSrc(normalizeHonorific(otherPlayer.honorific))}
                  alt=""
                />
              </span>
            )}
            <span className="game-info-panel-label">{otherName}</span>
            {otherPlayerScore != null && (
              <span className="game-info-panel-score">{otherPlayerScore}</span>
            )}
          </div>
        </div>

        {/* Main bar row */}
        <div className="game-info-panel-bar">
          <button
            type="button"
            className="game-info-panel-menu-btn"
            onClick={toggleDrawer}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
          >
            {drawerOpen ? <ChevronDownIcon /> : <MenuIcon />}
          </button>

          {activePlayer && (
            <span className="game-info-panel-avatar" aria-hidden="true">
              <img
                src={getPlayerArtSrc(normalizeHonorific(activePlayer.honorific))}
                alt=""
              />
            </span>
          )}
          <span className="game-info-panel-label">{turnName}'s turn</span>
          {score != null && <span className="game-info-panel-score">{score}</span>}
        </div>
      </div>
    </>
  );
}
