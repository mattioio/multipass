export interface RoundState {
  pickerId: string | null;
  firstPlayerId: string | null;
  shuffleAt: number | null;
  status: "waiting_game" | "shuffling" | "playing";
  hostGameId: string | null;
  guestGameId: string | null;
  resolvedGameId: string | null;
  hasPickedStarter: boolean;
}
