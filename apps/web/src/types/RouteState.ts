import type { ScreenKey } from "./ScreenKey";
import type { JoinRoute } from "./JoinRoute";

export interface RouteState {
  hash: string;
  screen: ScreenKey;
  join: JoinRoute;
}
