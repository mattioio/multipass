import { PlayerAvatar } from "./PlayerAvatar";

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
      <span className="avatar-shell">
        <span className="avatar-inner">
          <PlayerAvatar />
          <span className="avatar-lower-third">
            <span className="avatar-name">{label}</span>
          </span>
        </span>
        {selected ? (
          <span className="avatar-selected-badge" aria-hidden="true">
            <span className="avatar-selected-check">✓</span>
            <span className="avatar-selected-label">Selected</span>
          </span>
        ) : null}
        <span className="lock-badge" aria-hidden="true">
          🔒<span>Player 1</span>
        </span>
      </span>
    </button>
  );
}
