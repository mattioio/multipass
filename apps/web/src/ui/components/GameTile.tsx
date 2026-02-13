import type { ReactNode } from "react";

export interface GameTileProps {
  title: string;
  bannerClassName?: string;
  badge?: ReactNode;
  cta: ReactNode;
}

export function GameTile({ title, bannerClassName = "game-banner game-banner-tic-tac-toe", badge, cta }: GameTileProps) {
  return (
    <article className="game-card">
      <div className={bannerClassName}>
        <div className="game-banner-label">Classic Grid Duel</div>
      </div>
      <div className="game-meta">
        <div className="game-name-row">
          <h3 className="game-name">{title}</h3>
          {badge}
        </div>
        <div className="game-cta-row">{cta}</div>
      </div>
    </article>
  );
}
