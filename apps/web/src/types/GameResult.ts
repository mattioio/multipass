export interface GameResult {
  status: "in_progress" | "winner" | "draw";
  winnerId: string | null;
  draw: boolean;
  message?: string;
}
