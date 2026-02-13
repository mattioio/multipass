import type { PropsWithChildren } from "react";

export interface GameActionRowProps extends PropsWithChildren {
  className?: string;
}

export function GameActionRow({ className = "game-action-row", children }: GameActionRowProps) {
  return <div className={className}>{children}</div>;
}
