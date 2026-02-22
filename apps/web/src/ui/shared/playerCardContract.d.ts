export interface PlayerCardModel {
  id: string;
  name: string;
  roleLabel: string;
  theme: string;
  artSrc: string;
  isWaiting: boolean;
  isLeader: boolean;
  isLocked: boolean;
  isSelected: boolean;
}

export interface PlayerCardClassNames {
  variant: "picker" | "score" | "compact";
  shell: string;
  inner: string;
  art: string;
  artImage: string;
  lowerThird: string;
  name: string;
  role: string;
  badge: string;
  selectedBadge: string;
  selectedCheck: string;
  selectedLabel: string;
  lockBadge: string;
  leaderBadge: string;
  spinner: string;
}

export const PLAYER_CARD_VARIANTS: {
  readonly picker: "picker";
  readonly score: "score";
  readonly compact: "compact";
};

export function buildPlayerCardModel(input?: Partial<PlayerCardModel>): PlayerCardModel;

export function getPlayerCardClassNames(
  variant: "picker" | "score" | "compact",
  state?: Partial<PlayerCardModel>
): PlayerCardClassNames;
