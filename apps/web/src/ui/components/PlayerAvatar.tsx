export interface PlayerAvatarProps {
  alt?: string;
  className?: string;
}

export function PlayerAvatar({ alt = "", className = "player-art" }: PlayerAvatarProps) {
  return (
    <span className={className} aria-hidden="true">
      <img src="/src/assets/player.svg" alt={alt} />
    </span>
  );
}
