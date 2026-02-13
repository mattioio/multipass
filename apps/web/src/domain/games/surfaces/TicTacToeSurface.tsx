import type { GameComponentProps } from "../../../types/GameComponentProps";

export function TicTacToeSurface({ gameId, name, runtime, onPrimaryAction }: GameComponentProps) {
  return (
    <article className={`game-module game-module-${runtime.uiState}`} data-game-id={gameId}>
      <header className="game-module-head">
        <h4>{name}</h4>
        <span className="game-chip choice-chip">{runtime.uiState.replace("_", " ")}</span>
      </header>
      <p className="subtext">Classic 3x3 tactical duel. First to line up three marks wins.</p>
      <div className="game-module-actions">
        <button type="button" className="game-cta" onClick={onPrimaryAction} disabled={runtime.uiState === "disabled"}>
          Open module
        </button>
      </div>
    </article>
  );
}
