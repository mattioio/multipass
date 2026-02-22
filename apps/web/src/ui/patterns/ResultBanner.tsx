import type { ReactNode } from "react";

export interface ResultBannerProps {
  emojiId?: string;
  titleId?: string;
  emoji?: ReactNode;
  title: string;
}

export function ResultBanner({ emojiId = "winner-emoji", titleId = "winner-title", emoji, title }: ResultBannerProps) {
  return (
    <div className="result-banner">
      {emoji ? <div id={emojiId} className="winner-hero-emoji">{emoji}</div> : null}
      <h2 id={titleId} className="winner-title">{title}</h2>
    </div>
  );
}
