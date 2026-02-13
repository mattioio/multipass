import playerAvatar from "../../assets/player.svg";

export interface PlayerAvatarProps {
  alt?: string;
  className?: string;
}

export function PlayerAvatar({ alt = "", className = "player-art" }: PlayerAvatarProps) {
  return (
    <span className={className} aria-hidden="true">
      <img src={playerAvatar} alt={alt} />
    </span>
  );
}
