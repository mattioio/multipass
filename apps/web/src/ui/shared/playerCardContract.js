export const PLAYER_CARD_VARIANTS = Object.freeze({
  picker: "picker",
  score: "score",
  compact: "compact"
});

const VALID_VARIANTS = new Set(Object.values(PLAYER_CARD_VARIANTS));

function normalizeVariant(variant) {
  return VALID_VARIANTS.has(variant) ? variant : PLAYER_CARD_VARIANTS.picker;
}

export function buildPlayerCardModel(input = {}) {
  return {
    id: input?.id ? String(input.id) : "",
    name: input?.name ? String(input.name) : "",
    roleLabel: input?.roleLabel ? String(input.roleLabel) : "",
    theme: input?.theme ? String(input.theme) : "",
    artSrc: input?.artSrc ? String(input.artSrc) : "",
    isWaiting: Boolean(input?.isWaiting),
    isLeader: Boolean(input?.isLeader),
    isLocked: Boolean(input?.isLocked),
    isSelected: Boolean(input?.isSelected)
  };
}

export function getPlayerCardClassNames(variant, state = {}) {
  const normalizedVariant = normalizeVariant(variant);
  const isWaiting = Boolean(state?.isWaiting);
  const isLeader = Boolean(state?.isLeader);
  const isLocked = Boolean(state?.isLocked);
  const isSelected = Boolean(state?.isSelected);

  const isPickerVariant = normalizedVariant === PLAYER_CARD_VARIANTS.picker;

  const shell = [
    "player-card-shell",
    `player-card-shell--${normalizedVariant}`,
    isWaiting ? "is-waiting" : "",
    isLeader ? "is-leader" : "",
    isLocked ? "is-locked" : "",
    isSelected ? "is-selected" : "",
    isPickerVariant ? "avatar-shell" : ""
  ].filter(Boolean).join(" ");

  const inner = [
    "player-card-inner",
    `player-card-inner--${normalizedVariant}`,
    isPickerVariant ? "avatar-inner" : ""
  ].filter(Boolean).join(" ");

  const art = [
    "player-card-art",
    `player-card-art--${normalizedVariant}`,
    isWaiting ? "player-card-art-placeholder" : "",
    isPickerVariant ? "player-art" : ""
  ].filter(Boolean).join(" ");

  const lowerThird = [
    "player-card-lower-third",
    `player-card-lower-third--${normalizedVariant}`,
    isPickerVariant ? "avatar-lower-third" : ""
  ].filter(Boolean).join(" ");

  const name = [
    "player-card-name",
    `player-card-name--${normalizedVariant}`,
    isPickerVariant ? "avatar-name" : ""
  ].filter(Boolean).join(" ");

  const role = [
    "player-card-role",
    `player-card-role--${normalizedVariant}`
  ].filter(Boolean).join(" ");

  return {
    variant: normalizedVariant,
    shell,
    inner,
    art,
    artImage: "player-card-art-image",
    lowerThird,
    name,
    role,
    badge: "player-card-badge",
    selectedBadge: "player-card-badge player-card-badge--selected avatar-selected-badge",
    selectedCheck: "player-card-badge-check avatar-selected-check",
    selectedLabel: "player-card-badge-label avatar-selected-label",
    lockBadge: "player-card-badge player-card-badge--lock lock-badge",
    leaderBadge: "player-card-badge player-card-badge--leader",
    spinner: "player-card-spinner score-avatar-spinner"
  };
}
