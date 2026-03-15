import { PlayerCardShell } from "../../components";
import {
  AVATAR_OPTIONS,
  formatHonorificName,
  getPlayerArtSrc,
  type AvatarId,
  type HonorificValue,
  type LocalSetupStep,
} from "./appScreensUtils";

export interface LocalAvatarGridProps {
  selectedAvatarId: string | null;
  localStep: LocalSetupStep;
  localAvatars: { one: string | null; two: string | null };
  localHonorifics: { p1: HonorificValue; p2: HonorificValue };
  onSelect: (avatarId: AvatarId) => void;
}

export function LocalAvatarGrid({
  selectedAvatarId,
  localStep,
  localAvatars,
  localHonorifics,
  onSelect
}: LocalAvatarGridProps) {
  return (
    <div id="local-avatar-grid" className="avatar-picker local-avatar-grid">
      {AVATAR_OPTIONS.map((avatar) => {
        const isLocked = localStep === "p2" && localAvatars.one === avatar.id;
        const isSelected = selectedAvatarId === avatar.id;
        const tileHonorific = isLocked
          ? localHonorifics.p1
          : (localStep === "p1" ? localHonorifics.p1 : localHonorifics.p2);

        const tileName = formatHonorificName(avatar.name, tileHonorific);
        const tileArt = getPlayerArtSrc(tileHonorific);

        return (
          <button
            key={avatar.id}
            className={`avatar-option square-option theme-${avatar.theme}${isSelected ? " selected" : ""}${isLocked ? " p1-locked" : ""}`}
            data-avatar={avatar.id}
            data-selected={String(isSelected)}
            aria-pressed={isSelected}
            type="button"
            disabled={isLocked}
            onClick={() => onSelect(avatar.id)}
          >
            <PlayerCardShell
              variant="picker"
              themeClass={`theme-${avatar.theme}`}
              name={tileName}
              artSrc={tileArt}
              selected={isSelected && !isLocked}
              locked={isLocked}
            />
          </button>
        );
      })}
    </div>
  );
}
