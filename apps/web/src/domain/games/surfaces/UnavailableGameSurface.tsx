import type { GameComponentProps } from "../../../types/GameComponentProps";

export function UnavailableGameSurface({ gameId, name }: GameComponentProps) {
  return (
    <article className="game-module game-module-unavailable" data-game-id={gameId}>
      <header className="game-module-head">
        <h4>{name}</h4>
        <span className="game-chip blocked-chip">Unavailable</span>
      </header>
      <p className="subtext">This game module is not ready in the current build.</p>
      <div className="game-module-actions">
        <button type="button" className="game-cta" disabled>
          Coming soon
        </button>
      </div>
    </article>
  );
}
