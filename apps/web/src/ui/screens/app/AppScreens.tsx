import { type PropsWithChildren } from "react";
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
  PlayerStatusStrip,
  ResultBanner,
  ScreenGuardBoundary,
  TurnStatusBar
} from "../../patterns";

export interface AppScreensProps {
  isDevBuild: boolean;
}

interface SheetScreenProps extends PropsWithChildren {
  id: string;
  className?: string;
  panelClassName?: string;
}

function SheetScreen({
  id,
  className = "",
  panelClassName = "",
  children
}: SheetScreenProps) {
  return (
    <Screen id={id} className={`sheet-screen ${className}`.trim()}>
      <div className="sheet-backdrop" data-sheet-close="true" aria-hidden="true" />
      <div className="sheet-drag-rail" data-sheet-handle="true" aria-hidden="true">
        <span className="sheet-handle-pill" />
      </div>
      <div className={`sheet-panel ${panelClassName}`.trim()} data-sheet-panel="true">
        {children}
      </div>
    </Screen>
  );
}

export function AppScreens({ isDevBuild }: AppScreensProps) {
  return (
    <>
      <Screen id="screen-landing" active>
        <div className="home-mode-grid">
          <Card className="landing-card local-card home-mode-card">
            <CardHeader className="landing-card-header landing-card-header-local">
              <span className="landing-card-icon landing-card-icon-local" aria-hidden="true" />
            </CardHeader>
            <h2 className="landing-title">Local</h2>
            <p className="subtext">Play together on this device.</p>
            <Button id="go-local" className="home-main-action">Local</Button>
          </Card>
          <Card className="landing-card online-card home-mode-card">
            <CardHeader className="landing-card-header landing-card-header-online">
              <span className="landing-card-icon landing-card-icon-online" aria-hidden="true" />
            </CardHeader>
            <h2 className="landing-title">Online</h2>
            <p className="subtext">Invite someone with a 4-letter code.</p>
            <Button id="go-online" variant="ghost" className="home-main-action">Online</Button>
          </Card>
        </div>
        <div className="landing-rejoin-stack">
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
        </div>
      </Screen>

      <SheetScreen id="screen-local" panelClassName="setup-sheet-panel">
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-local">
            <span className="setup-card-tag">Local</span>
            <button className="ghost setup-header-close" type="button" data-sheet-close="true">
              Close
            </button>
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
      </SheetScreen>

      <SheetScreen id="screen-online" panelClassName="setup-sheet-panel">
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online">
            <span className="setup-card-tag">Online</span>
            <button className="ghost setup-header-close" type="button" data-sheet-close="true">
              Close
            </button>
          </CardHeader>
          <h2 className="player-picker-title">Online play</h2>
          <p className="subtext">Host a room or join a friend with a 4-letter code.</p>
          <div className="button-row">
            <Button id="go-host">Host a room</Button>
            <Button id="go-join" variant="ghost">Join a room</Button>
          </div>
        </Card>
      </SheetScreen>

      <SheetScreen id="screen-host" panelClassName="setup-sheet-panel">
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online">
            <span className="setup-card-tag">Online</span>
            <button className="ghost setup-header-close" type="button" data-sheet-close="true">
              Close
            </button>
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
      </SheetScreen>

      <SheetScreen id="screen-join" panelClassName="setup-sheet-panel">
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-online">
            <span className="setup-card-tag">Online</span>
            <button className="ghost setup-header-close" type="button" data-sheet-close="true">
              Close
            </button>
          </CardHeader>
          <h2>Join a room</h2>
          <JoinCodeForm />
          <div className="button-row join-setup-cta-row">
            <Button id="join-room" className="cta-main">
              Continue
            </Button>
          </div>
        </Card>
      </SheetScreen>

      <Screen id="screen-lobby">
        <div className="lobby-panel">
          <ScoreColumns id="score-columns" />
          <section className="lobby-games-panel" aria-labelledby="lobby-games-title">
            <p id="pick-status" className="pick-status hidden" aria-live="polite"></p>
            <div id="game-list" className="game-grid"></div>
          </section>
        </div>
      </Screen>

      <Screen id="screen-pick">
        <div className="screen-head pick-head pick-legacy-note">
          <div>
            <h2>Pick a game</h2>
          </div>
        </div>
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
        <div className="game-screen-layout">
          <div className="game-turn-footer">
            <TurnStatusBar />
          </div>
          <GameSurfaceShell
            showHead={false}
            state="active"
            actions={(
              <GameActionRow>
                <Button id="game-close-board" variant="ghost" className="compact-action hidden">Close</Button>
                <Button id="end-game-game" variant="ghost" className="hidden">End game</Button>
                <Button id="new-round" variant="ghost" className="hidden">New round</Button>
              </GameActionRow>
            )}
          >
            <div id="ttt-board" className="ttt-board"></div>
            <div id="dots-layout" className="dots-layout hidden">
              <div id="dots-board" className="dots-board"></div>
            </div>
            <div id="unsupported-game-layout" className="unsupported-game-layout hidden" aria-live="polite">
              <div className="unsupported-game-card">
                <h3 id="unsupported-game-title">Game unavailable</h3>
                <p id="unsupported-game-message" className="subtext">
                  This game mode is no longer supported in this version.
                </p>
              </div>
            </div>
            <div id="word-fight-layout" className="word-fight-layout hidden">
              <div className="word-fight-controls">
                <div id="word-fight-actions" className="word-fight-actions hidden">
                  <Button id="word-fight-pass-turn" variant="ghost" className="compact-action hidden">Pass turn</Button>
                </div>
                <div id="word-fight-keyboard" className="word-fight-keyboard" aria-label="Word Fight keyboard">
                  <div className="word-fight-keyboard-row">
                    <button type="button" className="word-fight-key" data-word-fight-key="Q">Q</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="W">W</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="E">E</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="R">R</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="T">T</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="Y">Y</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="U">U</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="I">I</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="O">O</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="P">P</button>
                  </div>
                  <div className="word-fight-keyboard-row">
                    <button type="button" className="word-fight-key" data-word-fight-key="A">A</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="S">S</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="D">D</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="F">F</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="G">G</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="H">H</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="J">J</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="K">K</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="L">L</button>
                  </div>
                  <div className="word-fight-keyboard-row">
                    <button type="button" className="word-fight-key is-action" data-word-fight-key="ENTER">ENTER</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="Z">Z</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="X">X</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="C">C</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="V">V</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="B">B</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="N">N</button>
                    <button type="button" className="word-fight-key" data-word-fight-key="M">M</button>
                    <button type="button" className="word-fight-key is-action" data-word-fight-key="BACKSPACE">⌫</button>
                  </div>
                </div>
                <p id="word-fight-status" className="subtext word-fight-status">Take turns to crack your own word.</p>
              </div>
              <section className="word-fight-board-card word-fight-board-card-single">
                <div className="word-fight-board-header">
                  <h3 id="word-fight-active-title">Hint: --</h3>
                  <span id="word-fight-turn-timer" className="word-fight-turn-timer" aria-label="Turn timer">1:30</span>
                </div>
                <div id="word-fight-active-board" className="word-fight-board-grid"></div>
              </section>
            </div>
            <div id="poker-dice-layout" className="poker-dice-layout hidden">
              <p id="poker-dice-round-title" className="poker-dice-round-title">Round 1 of 3</p>
              <div id="poker-dice-dice" className="poker-dice-dice"></div>
              <div className="poker-dice-actions">
                <Button id="poker-dice-roll" className="compact-action">Roll</Button>
                <Button id="poker-dice-bank" variant="ghost" className="compact-action">Bank</Button>
                <Button id="poker-dice-pass-play" variant="ghost" className="compact-action hidden">Pass play</Button>
                <Button id="poker-dice-clear-hold" variant="ghost" className="compact-action">Clear holds</Button>
              </div>
              <section className="poker-dice-score-guide" aria-label="Poker hand scores">
                <h3 className="poker-dice-score-guide-title">Poker hand scores</h3>
                <div className="poker-dice-score-rows">
                  <div className="poker-dice-score-row" data-poker-category="royal_flush"><strong>Royal flush</strong><span>20 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="flush"><strong>Straight flush</strong><span>16 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="five_kind"><strong>Five of a kind</strong><span>12 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="four_kind"><strong>Four of a kind</strong><span>10 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="full_house"><strong>Full house</strong><span>8 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="three_kind"><strong>Three of a kind</strong><span>4 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="two_pair"><strong>Two pair</strong><span>2 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="one_pair"><strong>One pair</strong><span>0 pts</span></div>
                  <div className="poker-dice-score-row" data-poker-category="high_card"><strong>High card</strong><span>0 pts</span></div>
                </div>
              </section>
            </div>
          </GameSurfaceShell>
        </div>
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
