import { AvatarTile } from "./AvatarTile";

export interface AvatarPickerGridProps {
  id: string;
  className?: string;
  hidden?: boolean;
  selectedId?: string | null;
  disabledIds?: string[];
  onSelect?: (avatarId: string) => void;
}

const avatarOptions = [
  { id: "yellow", label: "Yellow", themeClass: "theme-yellow" },
  { id: "red", label: "Red", themeClass: "theme-red" },
  { id: "green", label: "Green", themeClass: "theme-green" },
  { id: "blue", label: "Blue", themeClass: "theme-blue" }
] as const;

export function AvatarPickerGrid({
  id,
  className = "avatar-picker local-avatar-grid",
  hidden = false,
  selectedId = null,
  disabledIds = [],
  onSelect
}: AvatarPickerGridProps) {
  const classes = [className, hidden ? "hidden" : ""].filter(Boolean).join(" ");
  return (
    <div id={id} className={classes}>
      {avatarOptions.map((avatar) => (
        <AvatarTile
          key={avatar.id}
          avatarId={avatar.id}
          label={avatar.label}
          themeClass={avatar.themeClass}
          selected={avatar.id === selectedId}
          disabled={disabledIds.includes(avatar.id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
