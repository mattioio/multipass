import type { Player } from "../../types";
import {
  getPlayerArtSrc,
  getDisplayPlayerName,
  normalizeHonorific,
} from "../screens/app/appScreensUtils";

export interface GamePanelProps {
  mode: "intro" | "turn" | "winner" | "draw";
  activePlayer: Player | null;
  winnerPlayer: Player | null;
  gameBlurb: string;
  gameName: string;
  onStart: () => void;
  onNextGame: () => void;
}

export function GamePanel({
  mode,
  activePlayer,
  winnerPlayer,
  gameBlurb,
  gameName,
  onStart,
  onNextGame,
}: GamePanelProps) {
  if (mode === "intro") {
    return (
      <div className="game-info-panel" data-mode="intro">
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

  // Turn mode
  const themeClass = activePlayer?.theme ? `theme-${activePlayer.theme}` : "";
  const turnName = getDisplayPlayerName(activePlayer, "Player");

  return (
    <div className={`game-info-panel ${themeClass}`} data-mode="turn">
      {activePlayer && (
        <span className="game-info-panel-avatar" aria-hidden="true">
          <img
            src={getPlayerArtSrc(normalizeHonorific(activePlayer.honorific))}
            alt=""
          />
        </span>
      )}
      <span className="game-info-panel-label">{turnName}'s turn</span>
    </div>
  );
}
