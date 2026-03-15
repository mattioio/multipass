import {
  Button,
  Card,
  CardHeader,
  Screen
} from "../../components";
import type { ScreenKey } from "../../../types";
import {
  SETUP_SHEET_SCREENS,
  formatStartedAgo,
} from "./appScreensUtils";

export interface LandingSectionProps {
  activeScreen: ScreenKey;
  hasLocalRejoin: boolean;
  localRejoinStartedAt: number | null;
  hasOnlineRejoin: boolean;
  onlineRejoinCode: string;
  onlineRejoinStartedLabel: string;
  onGoLocal: () => void;
  onGoOnline: () => void;
  onLocalRejoin: () => void;
  onClearLocalRejoin: () => void;
  onRejoin: () => void;
  onClearRejoin: () => void;
}

export function LandingSection({
  activeScreen,
  hasLocalRejoin,
  localRejoinStartedAt,
  hasOnlineRejoin,
  onlineRejoinCode,
  onlineRejoinStartedLabel,
  onGoLocal,
  onGoOnline,
  onLocalRejoin,
  onClearLocalRejoin,
  onRejoin,
  onClearRejoin,
}: LandingSectionProps) {
  return (
    <Screen id="screen-landing" active={activeScreen === "landing" || SETUP_SHEET_SCREENS.has(activeScreen)}>
      <div className="home-mode-grid">
        <Card className="landing-card local-card home-mode-card">
          <CardHeader className="landing-card-header landing-card-header-local">
            <span className="landing-card-icon landing-card-icon-local" aria-hidden="true" />
          </CardHeader>
          <h2 className="landing-title">Local</h2>
          <p className="subtext">Play together on this device.</p>
          <Button
            id="go-local"
            className="home-main-action"
            onClick={onGoLocal}
          >
            Start
          </Button>
        </Card>
        <Card className="landing-card online-card home-mode-card">
          <CardHeader className="landing-card-header landing-card-header-online">
            <span className="landing-card-icon landing-card-icon-online" aria-hidden="true" />
          </CardHeader>
          <h2 className="landing-title">Online</h2>
          <p className="subtext">Invite someone with a 4-letter code.</p>
          <Button
            id="go-online"
            variant="ghost"
            className="home-main-action"
            onClick={onGoOnline}
          >
            Play Online
          </Button>
        </Card>
      </div>

      <div className="landing-rejoin-stack">
        <div id="local-rejoin-card" className={`rejoin-card landing-rejoin-card${hasLocalRejoin ? "" : " hidden"}`}>
          <div className="landing-rejoin-content">
            <h3>Resume local match</h3>
            <p id="local-rejoin-summary" className="subtext">
              {formatStartedAgo(localRejoinStartedAt)}
            </p>
          </div>
          <div className="button-row landing-rejoin-actions">
            <Button
              id="local-rejoin-room"
              className="banner-action"
              onClick={onLocalRejoin}
              disabled={!hasLocalRejoin}
            >
              Resume
            </Button>
            <Button
              id="local-clear-rejoin"
              variant="ghost"
              className="compact-action banner-action"
              onClick={onClearLocalRejoin}
              disabled={!hasLocalRejoin}
            >
              Leave
            </Button>
          </div>
        </div>

        <div id="rejoin-card" className={`rejoin-card landing-rejoin-card${hasOnlineRejoin ? "" : " hidden"}`}>
          <div className="landing-rejoin-content">
            <h3>Rejoin online room</h3>
            <p id="online-rejoin-summary" className="subtext">
              Room <strong id="rejoin-code">{hasOnlineRejoin ? onlineRejoinCode : "----"}</strong>
              {" · "}
              <span id="online-rejoin-started">{onlineRejoinStartedLabel}</span>
            </p>
          </div>
          <div className="button-row landing-rejoin-actions">
            <Button
              id="rejoin-room"
              className="banner-action"
              onClick={onRejoin}
              disabled={!hasOnlineRejoin}
            >
              Rejoin
            </Button>
            <Button
              id="clear-rejoin"
              variant="ghost"
              className="compact-action banner-action"
              onClick={onClearRejoin}
              disabled={!hasOnlineRejoin}
            >
              Leave
            </Button>
          </div>
        </div>
      </div>
    </Screen>
  );
}
