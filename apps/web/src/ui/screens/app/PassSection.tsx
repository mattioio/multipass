import {
  Button,
  Screen
} from "../../components";
import type { ScreenKey } from "../../../types";

export interface PassSectionProps {
  activeScreen: ScreenKey;
  prompt: string;
  onReady: () => void;
}

export function PassSection({
  activeScreen,
  prompt,
  onReady,
}: PassSectionProps) {
  return (
    <Screen id="screen-pass" active={activeScreen === "pass"}>
      <div className="panel pass-panel">
        <h2 id="pass-title">Pass the device</h2>
        <p id="pass-message" className="subtext">{prompt || "Hand over to the next player, then continue."}</p>
        <div className="button-row winner-actions">
          <Button id="pass-ready" onClick={onReady}>Ready</Button>
        </div>
      </div>
    </Screen>
  );
}
