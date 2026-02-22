import playerAvatar from "../../assets/player.svg";
import { PlayerCardShell } from "./PlayerCardShell";

export interface AvatarTileProps {
  avatarId: string;
  label: string;
  themeClass: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (avatarId: string) => void;
}

export function AvatarTile({
  avatarId,
  label,
  themeClass,
  selected = false,
  disabled = false,
  onSelect
}: AvatarTileProps) {
  return (
    <button
      className={`avatar-option square-option ${themeClass}${selected ? " selected" : ""}`}
      data-avatar={avatarId}
      data-selected={String(selected)}
      aria-pressed={selected}
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(avatarId)}
    >
      <PlayerCardShell
        variant="picker"
        themeClass={themeClass}
        name={label}
        artSrc={playerAvatar}
        selected={selected}
      />
    </button>
  );
}
