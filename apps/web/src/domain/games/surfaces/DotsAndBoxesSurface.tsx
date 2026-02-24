import type { GameComponentProps } from "../../../types/GameComponentProps";

export function DotsAndBoxesSurface({ gameId, name, runtime, onPrimaryAction }: GameComponentProps) {
  return (
    <article className={`game-module game-module-${runtime.uiState}`} data-game-id={gameId}>
      <header className="game-module-head">
        <h4>{name}</h4>
        <span className="game-chip choice-chip">{runtime.uiState.replace("_", " ")}</span>
      </header>
      <p className="subtext">Draw lines, close boxes, and keep your turn when you score.</p>
      <div className="game-module-actions">
        <button type="button" className="game-cta" onClick={onPrimaryAction} disabled={runtime.uiState === "disabled"}>
          Open module
        </button>
      </div>
    </article>
  );
}
