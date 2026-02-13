import { PlayerAvatar } from "./PlayerAvatar";

export interface AvatarTileProps {
  fruitId: string;
  label: string;
  themeClass: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (fruitId: string) => void;
}

export function AvatarTile({
  fruitId,
  label,
  themeClass,
  selected = false,
  disabled = false,
  onSelect
}: AvatarTileProps) {
  return (
    <button
      className={`fruit-option square-option ${themeClass}${selected ? " selected" : ""}`}
      data-fruit={fruitId}
      data-selected={String(selected)}
      aria-pressed={selected}
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(fruitId)}
    >
      <span className="fruit-shell">
        <span className="fruit-inner">
          <PlayerAvatar />
          <span className="fruit-lower-third">
            <span className="fruit-name">{label}</span>
          </span>
        </span>
        <span className="lock-badge" aria-hidden="true">
          🔒<span>Player 1</span>
        </span>
      </span>
    </button>
  );
}
