import playerAvatar from "../../assets/player.svg";
import playerAvatarAlt from "../../assets/player2.svg";
import type { Player, RoomState } from "../../types";

export interface TurnStatusBarProps {
  id?: string;
  className?: string;
  live?: "off" | "polite" | "assertive";
  room?: RoomState | null;
  displayState?: Record<string, unknown> | null;
  mode?: "idle" | "turn" | "winner" | "draw";
  activePlayerId?: string | null;
}

interface TurnScore {
  gameScore: number;
  showGameScore: boolean;
}

interface TurnHeaderScores {
  host: TurnScore;
  guest: TurnScore;
}

function asScore(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolveGameScores(
  room: RoomState | null | undefined,
  displayState: Record<string, unknown> | null | undefined
): TurnHeaderScores {
  const hostId = room?.players.host?.id || null;
  const guestId = room?.players.guest?.id || null;
  const activeGameId = room?.game?.id || null;
  const stateGame = displayState ?? room?.game?.state ?? null;

  const scores: TurnHeaderScores = {
    host: { gameScore: 0, showGameScore: false },
    guest: { gameScore: 0, showGameScore: false }
  };

  if (!activeGameId || !stateGame || typeof stateGame !== "object") {
    return scores;
  }

  if (activeGameId === "dots_and_boxes") {
    const roundScores = (stateGame as { scores?: Record<string, unknown> }).scores;
    scores.host.showGameScore = true;
    scores.guest.showGameScore = true;
    scores.host.gameScore = asScore(hostId && roundScores ? roundScores[hostId] : 0);
    scores.guest.gameScore = asScore(guestId && roundScores ? roundScores[guestId] : 0);
    return scores;
  }

  if (activeGameId === "word_fight") {
    const progressByPlayer = (stateGame as {
      progressByPlayer?: Record<string, { score?: number }>
    }).progressByPlayer;
    scores.host.showGameScore = true;
    scores.guest.showGameScore = true;
    scores.host.gameScore = asScore(hostId && progressByPlayer ? progressByPlayer[hostId]?.score : 0);
    scores.guest.gameScore = asScore(guestId && progressByPlayer ? progressByPlayer[guestId]?.score : 0);
    return scores;
  }

  if (activeGameId === "poker_dice") {
    const pointsByPlayer = (stateGame as { pointsByPlayer?: Record<string, unknown> }).pointsByPlayer;
    scores.host.showGameScore = true;
    scores.guest.showGameScore = true;
    scores.host.gameScore = asScore(hostId && pointsByPlayer ? pointsByPlayer[hostId] : 0);
    scores.guest.gameScore = asScore(guestId && pointsByPlayer ? pointsByPlayer[guestId] : 0);
    return scores;
  }

  return scores;
}

function normalizeHonorific(value: unknown): "mr" | "mrs" {
  return String(value || "").trim().toLowerCase() === "mrs" ? "mrs" : "mr";
}

function getPlayerArtSrc(player: Player | null | undefined): string {
  const honorific = normalizeHonorific(player?.honorific || "");
  return honorific === "mrs" ? playerAvatarAlt : playerAvatar;
}

function getDisplayPlayerName(player: Player | null | undefined, fallback: string): string {
  if (!player) return fallback;
  const direct = String(player.name || "").trim();
  return direct || fallback;
}

function resolveActiveSide(room: RoomState, activePlayerId: string | null): "host" | "guest" | "none" {
  if (!activePlayerId) return "none";
  if (room.players.host?.id === activePlayerId) return "host";
  if (room.players.guest?.id === activePlayerId) return "guest";
  return "none";
}

function resolveModeText(mode: "idle" | "turn" | "winner" | "draw", side: "host" | "guest", activeSide: "host" | "guest" | "none", hasPlayer: boolean): string {
  if (mode === "winner") return activeSide === side ? "Won" : "Waiting";
  if (mode === "draw") return "Draw";
  if (mode === "idle") return hasPlayer ? "Ready" : "Waiting";
  return activeSide === side ? "Turn" : "Waiting";
}

export function TurnStatusBar({
  id = "turn-indicator",
  className = "turn-indicator",
  live = "polite",
  room = null,
  displayState = null,
  mode = "idle",
  activePlayerId = null
}: TurnStatusBarProps) {
  const safeMode = mode === "winner" || mode === "draw" || mode === "turn" ? mode : "idle";
  const activeSide = room ? resolveActiveSide(room, activePlayerId) : "none";
  const headerScores = resolveGameScores(room, displayState);

  if (!room) {
    return (
      <div
        id={id}
        className={className}
        aria-live={live}
        data-mode="idle"
        data-active-side="none"
      ></div>
    );
  }

  const sides = [
    { side: "host" as const, player: room.players.host, fallback: "Player 1", score: headerScores.host },
    { side: "guest" as const, player: room.players.guest, fallback: "Player 2", score: headerScores.guest }
  ];

  return (
    <div
      id={id}
      className={className}
      aria-live={live}
      data-mode={safeMode}
      data-active-side={activeSide}
    >
      {sides.map(({ side, player, fallback, score }) => {
        const modeText = resolveModeText(safeMode, side, activeSide, Boolean(player));
        const paneThemeClass = player?.theme ? `theme-${player.theme}` : `theme-${side === "host" ? "red" : "green"}`;
        const paneName = getDisplayPlayerName(player, fallback);
        const isActive = activeSide === side;
        return (
          <section
            key={side}
            className={`turn-pane ${paneThemeClass}${!player ? " is-empty" : ""}`}
            data-side={side}
            data-active={isActive ? "true" : "false"}
            aria-label={`${paneName} ${modeText}`}
          >
            <span className="turn-avatar" aria-hidden="true">
              <img src={getPlayerArtSrc(player)} alt="" />
            </span>
            <span className="turn-meta">
              <span className="turn-name">{paneName}</span>
              <span className="turn-meta-row">
                <span className="turn-state">{modeText}</span>
              </span>
            </span>
            {score.showGameScore ? (
              <span className="turn-score-game" aria-label={`Current game score ${score.gameScore}`}>
                {score.gameScore}
              </span>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
