import type { GameComponentProps } from "../../../types";

export function GameTemplateSurface({ gameId, name, runtime }: GameComponentProps) {
  return (
    <article className={`game-module state-${runtime.uiState}`} data-game-id={gameId}>
      <header className="game-module-head">
        <h4>{name}</h4>
        <span className="game-chip choice-chip">{runtime.uiState}</span>
      </header>
      <p className="subtext">Replace this with game-specific module content.</p>
    </article>
  );
}
