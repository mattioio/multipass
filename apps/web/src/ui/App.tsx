import {
  ActionToast,
  AppShell,
  Button,
  Card,
  CardHeader,
  FruitPickerGrid,
  Modal,
  Screen,
  ScoreColumns,
  Toast
} from "./components";
import { DevKitchenScreen } from "./screens/DevKitchenScreen";

export function App() {
  const isDevBuild = import.meta.env.DEV;

  return (
    <>
      <AppShell>
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
                <Card id="landing-card-local" className="landing-card local-card">
                  <CardHeader className="landing-card-header landing-card-header-local">
                    <img src="/src/assets/local.svg" alt="" />
                  </CardHeader>
                  <h2 className="landing-title">Local Co-Op</h2>
                  <p className="subtext">Pass the device and play together on one screen.</p>
                  <Button id="go-local">Start</Button>
                </Card>
              </section>
              <section id="landing-panel-online" className="landing-panel" role="tabpanel" aria-labelledby="landing-tab-online">
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
                <Card id="landing-card-online" className="landing-card online-card">
                  <CardHeader className="landing-card-header landing-card-header-online">
                    <img src="/src/assets/online.svg" alt="" />
                  </CardHeader>
                  <h2 className="landing-title">Online play</h2>
                  <p className="subtext">Host a room or join a friend with a 4-letter code.</p>
                  <div className="button-row">
                    <Button id="go-host">Host a room</Button>
                    <Button id="go-join" variant="ghost">Join a room</Button>
                  </div>
                </Card>
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
              <div id="local-header-row" className="local-header-row">
                <h3 id="local-step-title">Player 1 choice</h3>
                <div id="local-stepper-inline" className="local-stepper-inline" aria-live="polite">
                  <div id="local-progress" className="local-progress" aria-hidden="true">
                    <span className="local-progress-segment active"></span>
                    <span className="local-progress-segment"></span>
                  </div>
                  <span id="local-step-count" className="local-step-count">1/2</span>
                </div>
              </div>
              <div className="local-choices">
                <FruitPickerGrid id="local-fruit-grid" />
              </div>
            </div>
          </Card>
        </Screen>

        <Screen id="screen-host">
          <Card className="setup-card">
            <CardHeader className="setup-card-header setup-card-header-online">
              <span className="setup-card-tag">Online</span>
            </CardHeader>
            <h2>Host a room</h2>
            <p className="subtext">Pick your fruit</p>
            <FruitPickerGrid id="host-fruit-picker" />
            <div className="button-row">
              <Button id="create-room">Create room</Button>
            </div>
          </Card>
        </Screen>

        <Screen id="screen-join">
          <Card className="setup-card">
            <CardHeader className="setup-card-header setup-card-header-online">
              <span className="setup-card-tag">Online</span>
            </CardHeader>
            <h2>Join a room</h2>
            <label>
              Room code
              <input id="join-code" type="text" maxLength={4} placeholder="ABCD" />
            </label>
            <p id="join-step-hint" className="subtext">Enter your room code to continue.</p>
            <FruitPickerGrid id="join-fruit-picker" hidden />
            <div className="button-row">
              <Button id="join-room">Continue</Button>
            </div>
          </Card>
        </Screen>

        <Screen id="screen-lobby">
          <div className="panel lobby-panel">
            <ScoreColumns id="score-columns" />
            <Button id="ready-cta" className="cta-main">Pick a game</Button>
            <Button id="end-game" variant="danger" className="hidden">End game</Button>
          </div>
        </Screen>

        <Screen id="screen-shuffle">
          <div className="panel shuffle-panel">
            <h2>Who starts?</h2>
            <div id="shuffle-display" className="shuffle-display wheel-stage">
              <div className="shuffle-strip-wrap">
                <div id="shuffle-strip-stage" className="shuffle-strip-stage" aria-label="Player starter picker">
                  <div id="shuffle-grid" className="shuffle-grid" aria-hidden="true"></div>
                </div>
                <Button id="shuffle-spin" aria-label="Spin to choose who starts">
                  <span className="wheel-spin-label">Spin</span>
                </Button>
              </div>
              <p id="shuffle-result" className="shuffle-name"></p>
            </div>
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
              <div id="wait-emoji" className="wait-emoji">🎲</div>
              <div>
                <div id="wait-name" className="wait-name">Picker</div>
                <p id="wait-text" className="subtext">is choosing the next game.</p>
              </div>
            </div>
          </div>
        </Screen>

        <Screen id="screen-game">
          <div className="screen-head">
            <Button id="end-game-game" variant="ghost" className="hidden">End game</Button>
          </div>

          <div className="game-panel">
            <div id="turn-indicator" className="turn-indicator turn-passive" aria-live="polite"></div>
            <div id="ttt-board" className="ttt-board"></div>
            <Button id="new-round" variant="ghost" className="hidden">New round</Button>
          </div>
        </Screen>

        <Screen id="screen-winner">
          <div className="panel winner-panel">
            <div id="winner-emoji" className="winner-hero-emoji">🎉</div>
            <h2 id="winner-title" className="winner-title">Winner</h2>
            <ScoreColumns id="winner-score-columns" className="score-columns winner-columns" />
            <div className="button-row winner-actions">
              <Button id="winner-play-again">Next game</Button>
              <Button id="winner-home" variant="ghost">Home</Button>
            </div>
          </div>
        </Screen>

        {isDevBuild ? (
          <Screen id="screen-devkit">
            <DevKitchenScreen />
          </Screen>
        ) : null}
      </AppShell>

      <Toast />
      <ActionToast />

      <Modal id="settings-modal" titleId="settings-title" title="Settings">
        <div className="setting-row">
          <span>Day / Night mode</span>
          <div className="mode-toggle" aria-label="Toggle light and dark mode">
            <span className="mode-icon" aria-hidden="true">☀️</span>
            <label className="switch">
              <input id="mode-toggle" type="checkbox" />
              <span className="slider"></span>
            </label>
            <span className="mode-icon" aria-hidden="true">🌙</span>
          </div>
        </div>
        {isDevBuild ? (
          <div className="setting-row">
            <span>Developer tools</span>
            <Button id="open-devkit" variant="ghost">Open component kitchen sink</Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
