export interface RoundState {
  pickerId: string | null;
  firstPlayerId: string | null;
  shuffleAt: number | null;
  status: "waiting_game" | "shuffling" | "countdown" | "playing";
  hostGameId: string | null;
  guestGameId: string | null;
  resolvedGameId: string | null;
  countdownStartedAt: number | null;
  countdownEndsAt: number | null;
  hasPickedStarter: boolean;
}
