import type { RoomState, ScreenKey } from "../../../types";
import {
  PlayerCardShell,
  Screen
} from "../../components";
import {
  asNumber,
  getDisplayPlayerName,
  getGameBannerClass,
  getLeaderId,
  getPlayerArtSrc,
  normalizeHonorific,
} from "./appScreensUtils";

export interface LobbyGame {
  id: string;
  name: string;
  comingSoon?: boolean;
}

export interface LobbySectionProps {
  activeScreen: ScreenKey;
  activeRoom: RoomState | null;
  isLocalMode: boolean;
  activeYouRole: string | null;
  currentGameEnded: boolean;
  lobbyGames: LobbyGame[];
  lobbyStatusMessage: string;
  onlineHostChoiceId: string | null;
  onlineGuestChoiceId: string | null;
  resolvedChoiceId: string | null;
  onlineCountdownActive: boolean;
  onlineCountdownSeconds: number | null;
  onSelectLobbyGame: (gameId: string) => void;
}

export function LobbySection({
  activeScreen,
  activeRoom,
  isLocalMode,
  activeYouRole,
  currentGameEnded,
  lobbyGames,
  lobbyStatusMessage,
  onlineHostChoiceId,
  onlineGuestChoiceId,
  resolvedChoiceId,
  onlineCountdownActive,
  onlineCountdownSeconds,
  onSelectLobbyGame,
}: LobbySectionProps) {
  return (
    <Screen id="screen-lobby" active={activeScreen === "lobby"}>
      <div className="lobby-hero-bg" aria-hidden="true" />
      <div className="lobby-panel">
        <div id="score-columns" className="score-columns">
          <div className="score-duel-panel">
            <div className="score-duel-sides">
              <div className={`score-duel-side theme-${activeRoom?.players.host?.theme || "red"}`}>
                <div className="score-duel-top">
                  <PlayerCardShell
                    variant="score"
                    themeClass={`theme-${activeRoom?.players.host?.theme || "red"}`}
                    name=""
                    artSrc={getPlayerArtSrc(normalizeHonorific(activeRoom?.players.host?.honorific || "mr"))}
                    leader={Boolean(activeRoom?.players.host && getLeaderId([activeRoom.players.host, activeRoom.players.guest]) === activeRoom.players.host.id)}
                  />
                </div>
                <div className="score-duel-meta">
                  <div className="score-duel-name">
                    {getDisplayPlayerName(activeRoom?.players.host, "Host")}
                  </div>
                  <div className="score-duel-points">{String(asNumber(activeRoom?.players.host?.gamesWon, 0))}</div>
                </div>
              </div>

              <div className="score-duel-divider" aria-hidden="true" />

              <div className={`score-duel-side score-duel-side-guest theme-${activeRoom?.players.guest?.theme || "green"}${activeRoom?.players.guest ? "" : " score-duel-side-waiting"}`}>
                <div className="score-duel-top">
                  <PlayerCardShell
                    variant="score"
                    themeClass={`theme-${activeRoom?.players.guest?.theme || "green"}`}
                    name=""
                    artSrc={getPlayerArtSrc(normalizeHonorific(activeRoom?.players.guest?.honorific || "mr"))}
                    waiting={!activeRoom?.players.guest}
                    leader={Boolean(activeRoom?.players.guest && getLeaderId([activeRoom.players.host, activeRoom.players.guest]) === activeRoom.players.guest.id)}
                  />
                </div>
                <div className="score-duel-meta">
                  <div className={`score-duel-name${activeRoom?.players.guest ? "" : " score-duel-name-waiting"}`}>
                    {activeRoom?.players.guest
                      ? getDisplayPlayerName(activeRoom.players.guest, "Guest")
                      : "Waiting"}
                  </div>
                  <div className={`score-duel-points${activeRoom?.players.guest ? "" : " score-duel-points-waiting"}`}>
                    {activeRoom?.players.guest ? String(asNumber(activeRoom.players.guest.gamesWon, 0)) : "--"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="lobby-games-panel" aria-labelledby="lobby-games-title">
          <h2 id="lobby-games-title" className="lobby-games-title">Pick a game</h2>
          <p id="pick-status" className={`pick-status${lobbyStatusMessage ? "" : " hidden"}`} aria-live="polite">
            {lobbyStatusMessage}
          </p>

          <div id="game-list" className="game-grid">
            {lobbyGames.map((game) => {
              const gameId = String(game.id || "");
              const comingSoon = Boolean(game.comingSoon);
              const gameActive = Boolean(activeRoom?.game && !currentGameEnded);
              const isCurrentActiveGame = Boolean(gameActive && activeRoom?.game?.id === gameId);
              const isPlayer = isLocalMode || activeYouRole === "host" || activeYouRole === "guest";
              const canPick = Boolean(isPlayer && activeRoom?.players.host && activeRoom?.players.guest && !gameActive);

              const myChoiceId = !isLocalMode
                ? (activeYouRole === "host" ? onlineHostChoiceId : onlineGuestChoiceId)
                : resolvedChoiceId;
              const otherChoiceId = !isLocalMode
                ? (activeYouRole === "host" ? onlineGuestChoiceId : onlineHostChoiceId)
                : null;

              const isMyChoice = myChoiceId === gameId;
              const isPeerChoice = otherChoiceId === gameId;
              const isCountdownTarget = Boolean(onlineCountdownActive && resolvedChoiceId === gameId);

              let ctaText = "Play";
              if (isCurrentActiveGame) {
                ctaText = "Resume game";
              } else if (isCountdownTarget) {
                ctaText = `Starting in ${onlineCountdownSeconds ?? 0}`;
              } else if (!isLocalMode && isPeerChoice && !isMyChoice) {
                ctaText = "Agree";
              } else if (!isLocalMode && isMyChoice) {
                ctaText = "Selected";
              }

              const ctaDisabled = comingSoon || (!canPick && !isCurrentActiveGame);

              const badge = (() => {
                if (comingSoon) {
                  return <span className="game-chip">Coming soon</span>;
                }

                if (!isLocalMode && isPeerChoice && !isMyChoice) {
                  return <span className="game-chip agree-chip">Teammate picked this</span>;
                }

                if (!isLocalMode && isMyChoice && !isCountdownTarget) {
                  return <span className="game-chip choice-chip">Your choice</span>;
                }

                return null;
              })();

              return (
                <article
                  key={gameId}
                  className={`game-card${comingSoon ? " coming-soon" : ""}${(isMyChoice || isCurrentActiveGame || isCountdownTarget) ? " active" : ""}${(isPeerChoice && !isMyChoice) ? " awaiting-agree" : ""}`}
                  aria-label={comingSoon ? `${game.name}, coming soon` : String(game.name)}
                  onMouseMove={(e) => {
                    const el = e.currentTarget;
                    const rect = el.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    const rotateY = (x - 0.5) * 6;
                    const rotateX = (0.5 - y) * 4;
                    el.style.setProperty("--card-rx", `${rotateX}deg`);
                    el.style.setProperty("--card-ry", `${rotateY}deg`);
                    el.style.setProperty("--card-shine-x", `${x * 100}%`);
                    el.style.setProperty("--card-shine-y", `${y * 100}%`);
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.setProperty("--card-rx", "0deg");
                    el.style.setProperty("--card-ry", "0deg");
                    el.style.setProperty("--card-shine-x", "50%");
                    el.style.setProperty("--card-shine-y", "50%");
                  }}
                >
                  <div className={`game-banner ${getGameBannerClass(gameId)}`} />
                  <div className="game-meta">
                    <div className="game-name-row">
                      <h3 className="game-name">{String(game.name || gameId)}</h3>
                      {badge}
                    </div>
                    <div className="game-cta-row">
                      <button
                        type="button"
                        className={`game-cta${(!isLocalMode && isPeerChoice && !isMyChoice) ? " is-agree" : ""}`}
                        disabled={ctaDisabled}
                        aria-label={comingSoon ? `${game.name} coming soon` : `${ctaText} ${game.name}`}
                        onClick={() => onSelectLobbyGame(gameId)}
                      >
                        {ctaText}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </Screen>
  );
}
