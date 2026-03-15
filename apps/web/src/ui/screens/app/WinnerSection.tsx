import { Screen } from "../../components";
import { ResultBanner } from "../../patterns";
import type { RoomState, ScreenKey } from "../../../types";
import {
  getDisplayPlayerName,
  playerById,
} from "./appScreensUtils";

export interface WinnerSectionProps {
  activeScreen: ScreenKey;
  activeRoom: RoomState | null;
  activeGameWinnerId: string | null;
  activeGameDraw: boolean;
}

export function WinnerSection({
  activeScreen,
  activeRoom,
  activeGameWinnerId,
  activeGameDraw,
}: WinnerSectionProps) {
  return (
    <Screen id="screen-winner" active={activeScreen === "winner"}>
      <div className="panel winner-panel">
        <ResultBanner
          emojiId="winner-fallback-emoji"
          titleId="winner-fallback-title"
          title={activeGameWinnerId
            ? `${getDisplayPlayerName(playerById(activeRoom, activeGameWinnerId), "Winner")} wins`
            : (activeGameDraw ? "Draw" : "Round finished")}
        />
        <p className="subtext">Use the game screen to view results.</p>
      </div>
    </Screen>
  );
}
