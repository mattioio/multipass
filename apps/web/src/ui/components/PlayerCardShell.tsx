import { buildPlayerCardModel, getPlayerCardClassNames, PLAYER_CARD_VARIANTS } from "../shared/playerCardContract";

export interface PlayerCardShellProps {
  variant: "picker" | "score" | "compact";
  themeClass: string;
  name: string;
  roleLabel?: string;
  artSrc: string;
  selected?: boolean;
  locked?: boolean;
  leader?: boolean;
  waiting?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export function PlayerCardShell({
  variant,
  themeClass,
  name,
  roleLabel,
  artSrc,
  selected = false,
  locked = false,
  leader = false,
  waiting = false,
  interactive = false,
  onClick
}: PlayerCardShellProps) {
  const model = buildPlayerCardModel({
    name,
    roleLabel,
    artSrc,
    isWaiting: waiting,
    isLeader: leader,
    isLocked: locked,
    isSelected: selected
  });
  const classes = getPlayerCardClassNames(variant, model);
  const showLowerThird = Boolean(name || roleLabel);
  const showLockSlot = variant === PLAYER_CARD_VARIANTS.picker;

  const RootTag = interactive ? "button" : "span";

  return (
    <RootTag
      className={`${classes.shell}${themeClass ? ` ${themeClass}` : ""}`}
      data-player-card-variant={variant}
      {...(interactive ? { type: "button", onClick } : {})}
    >
      <span className={classes.inner}>
        <span className={classes.art}>
          {!waiting ? <img className={classes.artImage} src={artSrc} alt="" /> : null}
        </span>
        {showLowerThird ? (
          <span className={classes.lowerThird}>
            {name ? <span className={classes.name}>{name}</span> : null}
            {roleLabel ? <span className={classes.role}>{roleLabel}</span> : null}
          </span>
        ) : null}
      </span>
      {selected ? (
        <span className={classes.selectedBadge} aria-hidden="true">
          <span className={classes.selectedCheck}>✓</span>
          <span className={classes.selectedLabel}>Selected</span>
        </span>
      ) : null}
      {leader ? <span className={classes.leaderBadge}>Leader</span> : null}
      {waiting ? <span className={classes.spinner} aria-hidden="true" /> : null}
      {showLockSlot ? <span className={classes.lockBadge} aria-hidden="true" /> : null}
    </RootTag>
  );
}
