import {
  Button,
  Card,
  CardHeader,
  AvatarPickerGrid,
  HonorificToggle,
  ScoreColumns,
  Screen
} from "../../components";
import { DevKitchenScreen } from "../DevKitchenScreen";
import {
  GameActionRow,
  GameSurfaceShell,
  JoinCodeForm,
  LobbyActions,
  PlayerStatusStrip,
  ResultBanner,
  ScreenGuardBoundary,
  TurnStatusBar
} from "../../patterns";

export interface AppScreensProps {
  isDevBuild: boolean;
}

export function AppScreens({ isDevBuild }: AppScreensProps) {
  return (
    <>
      <Screen id="screen-landing" active>
        <div className="landing-segmented-wrap">
          <div className="landing-segmented" role="tablist" aria-label="Choose play mode">
            <button
              id="landing-tab-local"
              className="landing-segment active"
              role="tab"
              type="button"
              aria-selected="true"
              aria-controls="landing-panel-local"
            >
              Local
            </button>
            <button
              id="landing-tab-online"
              className="landing-segment"
              role="tab"
              type="button"
              aria-selected="false"
              aria-controls="landing-panel-online"
            >
              Online
            </button>
          </div>
        </div>
        <div className="landing-carousel">
          <div id="landing-track" className="landing-track" data-mode="local">
            <section id="landing-panel-local" className="landing-panel" role="tabpanel" aria-labelledby="landing-tab-local">
              <Card id="landing-card-local" className="landing-card local-card">
                <CardHeader className="landing-card-header landing-card-header-local">
                  <span className="landing-card-icon landing-card-icon-local" aria-hidden="true" />
                </CardHeader>
                <h2 className="landing-title">Local Co-Op</h2>
                <p className="subtext">Pass the device and play together on one screen.</p>
                <Button id="go-local">Start</Button>
              </Card>
              <div id="local-rejoin-card" className="rejoin-card hidden landing-rejoin-card">
                <div className="landing-rejoin-content">
                  <h3>Resume local match</h3>
                  <p id="local-rejoin-summary" className="subtext">Started just now.</p>
                </div>
                <div className="button-row landing-rejoin-actions">
                  <Button id="local-rejoin-room" className="banner-action">Resume</Button>
                  <Button id="local-clear-rejoin" variant="ghost" className="compact-action banner-action">Leave</Button>
                </div>
              </div>
            </section>
            <section id="landing-panel-online" className="landing-panel" role="tabpanel" aria-labelledby="landing-tab-online">
              <Card id="landing-card-online" className="landing-card online-card">
                <CardHeader className="landing-card-header landing-card-header-online">
                  <span className="landing-card-icon landing-card-icon-online" aria-hidden="true" />
                </CardHeader>
                <h2 className="landing-title">Online play</h2>
                <p className="subtext">Host a room or join a friend with a 4-letter code.</p>
                <div className="button-row">
                  <Button id="go-host">Host a room</Button>
                  <Button id="go-join" variant="ghost">Join a room</Button>
                </div>
              </Card>
              <div id="rejoin-card" className="rejoin-card hidden landing-rejoin-card">
                <div className="landing-rejoin-content">
                  <h3>Rejoin online room</h3>
                  <p id="online-rejoin-summary" className="subtext">
                    Room <strong id="rejoin-code">----</strong> · <span id="online-rejoin-started">Started a bit ago.</span>
                  </p>
                </div>
                <div className="button-row landing-rejoin-actions">
                  <Button id="rejoin-room" className="banner-action">Rejoin</Button>
                  <Button id="clear-rejoin" variant="ghost" className="compact-action banner-action">Leave</Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </Screen>

      <Screen id="screen-local">
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-local">
            <span className="setup-card-tag">Local</span>
          </CardHeader>
          <div id="local-stage" className="local-wizard">
            <div id="local-header-row" className="local-header-row avatar-picker-header-row">
              <h2 id="local-step-title" className="player-picker-title">Player 1 choice</h2>
              <HonorificToggle id="local-honorific-toolbar" inputId="local-honorific-toggle" />
            </div>
            <div className="local-choices">
              <div>
                <AvatarPickerGrid id="local-avatar-grid" />
              </div>
              <div className="button-row local-setup-cta-row">
                <Button id="local-continue" className="cta-main" disabled>
                  Pick a player
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </Screen>

      <Screen id="screen-host">
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online">
            <span className="setup-card-tag">Online</span>
          </CardHeader>
          <div className="avatar-picker-stack">
            <div className="avatar-picker-header-row">
              <h2 className="player-picker-title">Host a room</h2>
              <HonorificToggle id="host-honorific-toolbar" inputId="host-honorific-toggle" />
            </div>
            <AvatarPickerGrid id="host-avatar-picker" />
            <div className="button-row host-setup-cta-row">
              <Button id="create-room" className="cta-main" disabled>
                Pick a player
              </Button>
            </div>
          </div>
        </Card>
      </Screen>

      <Screen id="screen-join">
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online">
            <span className="setup-card-tag">Online</span>
          </CardHeader>
          <h2>Join a room</h2>
          <JoinCodeForm />
          <div className="button-row join-setup-cta-row">
            <Button id="join-room" className="cta-main">
              Continue
            </Button>
          </div>
        </Card>
      </Screen>

      <Screen id="screen-lobby">
        <div className="panel lobby-panel">
          <ScoreColumns id="score-columns" />
          <LobbyActions />
        </div>
      </Screen>

      <Screen id="screen-pick">
        <div className="screen-head pick-head">
          <div>
            <h2>Pick a game</h2>
            <p id="pick-status" className="pick-status hidden" aria-live="polite"></p>
          </div>
        </div>
        <div id="game-list" className="game-grid"></div>
      </Screen>

      <Screen id="screen-wait">
        <div className="panel wait-panel">
          <h2>Waiting for a game</h2>
          <div className="wait-card">
            <div>
              <div id="wait-name" className="wait-name">Picker</div>
              <p id="wait-text" className="subtext">is choosing the next game.</p>
            </div>
          </div>
          <PlayerStatusStrip
            leftName="Host"
            leftState="Connected"
            rightName="Guest"
            rightState="Waiting"
            compact
          />
        </div>
      </Screen>

      <Screen id="screen-game">
        <GameSurfaceShell
          showHead={false}
          state="active"
          actions={(
            <GameActionRow>
              <Button id="end-game-game" variant="ghost" className="hidden">End game</Button>
              <Button id="new-round" variant="ghost" className="hidden">New round</Button>
            </GameActionRow>
          )}
        >
          <TurnStatusBar />
          <div id="ttt-board" className="ttt-board"></div>
          <div id="battleship-layout" className="battleship-layout hidden">
            <div className="battleship-controls">
              <p id="battleship-phase-label" className="subtext battleship-phase-label"></p>
              <div className="battleship-control-actions">
                <Button id="battleship-orientation" variant="ghost" className="compact-action">
                  Orientation: Horizontal
                </Button>
              </div>
            </div>
            <div className="battleship-boards">
              <section id="battleship-own-card" className="battleship-board-card">
                <h3 id="battleship-own-title">Your waters</h3>
                <div id="battleship-own-board" className="battleship-board"></div>
              </section>
            </div>
            <div id="battleship-action-row" className="battleship-action-row hidden">
              <Button id="battleship-clear-target" variant="ghost" className="compact-action">Clear</Button>
              <Button id="battleship-fire-target" className="compact-action">Fire</Button>
            </div>
          </div>
          <div id="game-result-panel" className="game-result-panel game-result-overlay hidden" aria-live="polite">
            <div className="game-result-sheet">
              <ResultBanner emojiId="game-result-emoji" titleId="winner-title" title="Winner" />
              <div id="winner-hero" className="game-result-hero hidden"></div>
              <ScoreColumns
                id="winner-score-columns"
                className="score-columns game-result-score-row"
              />
              <div className="button-row winner-actions game-result-actions">
                <Button id="winner-play-again" className="cta-main">
                  Next game
                </Button>
              </div>
            </div>
          </div>
        </GameSurfaceShell>
      </Screen>

      <Screen id="screen-pass">
        <div className="panel pass-panel">
          <h2 id="pass-title">Pass the device</h2>
          <p id="pass-message" className="subtext">Hand over to the next player, then continue.</p>
          <div className="button-row winner-actions">
            <Button id="pass-ready">Ready</Button>
          </div>
        </div>
      </Screen>

      <Screen id="screen-winner">
        <div className="panel winner-panel">
          <ResultBanner emojiId="winner-fallback-emoji" titleId="winner-fallback-title" title="Round finished" />
          <p className="subtext">Use the game screen to view results.</p>
        </div>
      </Screen>

      <ScreenGuardBoundary canRender={isDevBuild}>
        <Screen id="screen-devkit">
          <DevKitchenScreen />
        </Screen>
      </ScreenGuardBoundary>
    </>
  );
}
