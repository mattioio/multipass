import {
  AvatarPickerGrid,
  Button,
  Card,
  CardHeader,
  HonorificToggle,
} from "../../components";
import {
  JoinCodeForm,
} from "../../patterns";
import type { ScreenKey } from "../../../types";
import type { HonorificValue, LocalSetupStep, AvatarId } from "./appScreensUtils";
import { SheetScreen } from "./SheetScreen";
import { LocalAvatarGrid } from "./LocalAvatarGrid";

export interface SetupSheetsProps {
  activeScreen: ScreenKey;
  closingSetupScreen: ScreenKey | null;
  closeSetupSheetFor: (screen: ScreenKey) => void;

  // Local sheet
  localStep: LocalSetupStep;
  localHonorifics: { p1: HonorificValue; p2: HonorificValue };
  currentLocalAvatarId: string | null;
  localAvatars: { one: string | null; two: string | null };
  localCtaDisabled: boolean;
  localCtaLabel: string;
  onLocalHonorificChange: (step: LocalSetupStep, checked: boolean) => void;
  onLocalAvatarSelect: (step: LocalSetupStep, avatarId: string) => void;
  onLocalContinue: () => void;

  // Online sheet
  onGoHost: () => void;
  onGoJoin: () => void;

  // Host sheet
  hostAvatar: string | null;
  hostHonorific: HonorificValue;
  onHostAvatarSelect: (avatarId: string | null) => void;
  onHostHonorificChange: (checked: boolean) => void;
  onCreateRoom: () => void;

  // Join sheet
  normalizedJoinCode: string;
  joinStatusMessage: string;
  joinValidating: boolean;
  joinStep: "code" | "avatar";
  joinAvatar: string | null;
  joinDisabledAvatarIds: string[];
  joinHonorific: HonorificValue;
  joinHostAvatarId: AvatarId | null;
  joinLockedAvatarLabel: string | null;
  joinLockedAvatarArtSrc: string;
  joinCtaDisabled: boolean;
  joinCtaLabel: string;
  onJoinCodeChange: (code: string) => void;
  onJoinCodeComplete: (code: string) => void;
  onJoinAvatarSelect: (avatarId: string | null) => void;
  onJoinHonorificChange: (honorific: HonorificValue) => void;
  onJoinPrimaryAction: () => void;
}

export function SetupSheets({
  activeScreen,
  closingSetupScreen,
  closeSetupSheetFor,
  localStep,
  localHonorifics,
  currentLocalAvatarId,
  localAvatars,
  localCtaDisabled,
  localCtaLabel,
  onLocalHonorificChange,
  onLocalAvatarSelect,
  onLocalContinue,
  onGoHost,
  onGoJoin,
  hostAvatar,
  hostHonorific,
  onHostAvatarSelect,
  onHostHonorificChange,
  onCreateRoom,
  normalizedJoinCode,
  joinStatusMessage,
  joinValidating,
  joinStep,
  joinAvatar,
  joinDisabledAvatarIds,
  joinHonorific,
  joinHostAvatarId,
  joinLockedAvatarLabel,
  joinLockedAvatarArtSrc,
  joinCtaDisabled,
  joinCtaLabel,
  onJoinCodeChange,
  onJoinCodeComplete,
  onJoinAvatarSelect,
  onJoinHonorificChange,
  onJoinPrimaryAction,
}: SetupSheetsProps) {
  return (
    <>
      <SheetScreen
        id="screen-local"
        panelClassName="setup-sheet-panel"
        className={closingSetupScreen === "local" ? "is-closing" : ""}
        active={activeScreen === "local" || closingSetupScreen === "local"}
        onClose={() => closeSetupSheetFor("local")}
      >
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-local" data-sheet-header>
            <span className="setup-card-tag">Local</span>
            <button
              className="ghost setup-header-close"
              type="button"
              data-sheet-close="true"
              onClick={() => closeSetupSheetFor("local")}
            >
              Close
            </button>
          </CardHeader>
          <div id="local-stage" className="local-wizard" data-local-step={localStep}>
            <div id="local-header-row" className="local-header-row avatar-picker-header-row">
              <h2 id="local-step-title" className="player-picker-title">
                {localStep === "p1" ? "Player 1 choice" : "Player 2 choice"}
              </h2>
              <HonorificToggle
                id="local-honorific-toolbar"
                inputId="local-honorific-toggle"
                checked={(localStep === "p1" ? localHonorifics.p1 : localHonorifics.p2) === "mrs"}
                onChange={(checked) => onLocalHonorificChange(localStep, checked)}
              />
            </div>
            <div className="local-choices">
              <div>
                <LocalAvatarGrid
                  selectedAvatarId={currentLocalAvatarId}
                  localStep={localStep}
                  localAvatars={localAvatars}
                  localHonorifics={localHonorifics}
                  onSelect={(avatarId) => onLocalAvatarSelect(localStep, avatarId)}
                />
              </div>
              <div className="button-row local-setup-cta-row">
                <Button id="local-continue" className="cta-main" disabled={localCtaDisabled} onClick={onLocalContinue}>
                  {localCtaLabel}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </SheetScreen>

      <SheetScreen
        id="screen-online"
        panelClassName="setup-sheet-panel"
        className={closingSetupScreen === "online" ? "is-closing" : ""}
        active={activeScreen === "online" || closingSetupScreen === "online"}
        onClose={() => closeSetupSheetFor("online")}
      >
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online" data-sheet-header>
            <span className="setup-card-tag">Online</span>
            <button
              className="ghost setup-header-close"
              type="button"
              data-sheet-close="true"
              onClick={() => closeSetupSheetFor("online")}
            >
              Close
            </button>
          </CardHeader>
          <h2 className="player-picker-title">Online play</h2>
          <p className="subtext">Host a room or join a friend with a 4-letter code.</p>
          <div className="button-row">
            <Button
              id="go-host"
              onClick={onGoHost}
            >
              Host a room
            </Button>
            <Button
              id="go-join"
              variant="ghost"
              onClick={onGoJoin}
            >
              Join a room
            </Button>
          </div>
        </Card>
      </SheetScreen>

      <SheetScreen
        id="screen-host"
        panelClassName="setup-sheet-panel"
        className={closingSetupScreen === "host" ? "is-closing" : ""}
        active={activeScreen === "host" || closingSetupScreen === "host"}
        onClose={() => closeSetupSheetFor("host")}
      >
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online" data-sheet-header>
            <span className="setup-card-tag">Online</span>
            <button
              className="ghost setup-header-close"
              type="button"
              data-sheet-close="true"
              onClick={() => closeSetupSheetFor("host")}
            >
              Close
            </button>
          </CardHeader>
          <div className="avatar-picker-stack">
            <div className="avatar-picker-header-row">
              <h2 className="player-picker-title">Host a room</h2>
              <HonorificToggle
                id="host-honorific-toolbar"
                inputId="host-honorific-toggle"
                checked={hostHonorific === "mrs"}
                onChange={onHostHonorificChange}
              />
            </div>
            <AvatarPickerGrid id="host-avatar-picker" selectedId={hostAvatar} onSelect={onHostAvatarSelect} />
            <div className="button-row host-setup-cta-row">
              <Button
                id="create-room"
                className="cta-main"
                disabled={!hostAvatar}
                onClick={onCreateRoom}
              >
                {hostAvatar ? "Continue" : "Pick a player"}
              </Button>
            </div>
          </div>
        </Card>
      </SheetScreen>

      <SheetScreen
        id="screen-join"
        panelClassName="setup-sheet-panel"
        className={closingSetupScreen === "join" ? "is-closing" : ""}
        active={activeScreen === "join" || closingSetupScreen === "join"}
        onClose={() => closeSetupSheetFor("join")}
      >
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online" data-sheet-header>
            <span className="setup-card-tag">Online</span>
            <button
              className="ghost setup-header-close"
              type="button"
              data-sheet-close="true"
              onClick={() => closeSetupSheetFor("join")}
            >
              Close
            </button>
          </CardHeader>
          <h2>Join a room</h2>
          <JoinCodeForm
            code={normalizedJoinCode}
            statusMessage={joinStatusMessage}
            validating={joinValidating}
            step={joinStep}
            selectedAvatarId={joinAvatar}
            disabledAvatarIds={joinDisabledAvatarIds}
            honorific={joinHonorific}
            lockedAvatarId={joinHostAvatarId}
            lockedAvatarLabel={joinLockedAvatarLabel}
            lockedAvatarArtSrc={joinLockedAvatarArtSrc}
            onCodeChange={onJoinCodeChange}
            onCodeComplete={onJoinCodeComplete}
            onAvatarSelect={onJoinAvatarSelect}
            onHonorificChange={onJoinHonorificChange}
          />
          <div className="button-row join-setup-cta-row">
            <Button id="join-room" className="cta-main" disabled={joinCtaDisabled} onClick={onJoinPrimaryAction}>
              {joinCtaLabel}
            </Button>
          </div>
        </Card>
      </SheetScreen>
    </>
  );
}
