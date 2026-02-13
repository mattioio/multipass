export interface PickerGameItem {
  id: string;
  name: string;
  minPlayers?: number;
  maxPlayers?: number;
  comingSoon?: boolean;
  bannerKey?: string;
}

export function resolvePickerGames(games?: PickerGameItem[]): PickerGameItem[];
