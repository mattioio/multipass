import type { Player } from "./Player";
import type { RoundState } from "./RoundState";

export interface RoomState {
  code: string;
  createdAt: number;
  updatedAt: number;
  players: {
    host: Player | null;
    guest: Player | null;
  };
  round: RoundState | null;
  game: {
    id: string;
    name?: string;
    state: Record<string, unknown>;
  } | null;
  games?: Array<{ id: string; name: string; comingSoon?: boolean; bannerKey?: string }>;
}
