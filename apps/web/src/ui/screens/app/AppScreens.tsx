import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren
} from "react";
import { useRuntime } from "../../../app/runtime";
import {
  confirmLocalHandoff,
  createInitialLocalPrivacyState,
  queueLocalHandoff,
  shouldShowLocalPassScreen
} from "../../../legacy/localPrivacy.js";
import { syncDockFromSourceButtons } from "../../../legacy/appDockSync.js";
import { normalizeRoomCode } from "../../../legacy/hashRoute.js";
import { getLocalGame, listLocalGames } from "../../../domain/localGames.js";
import { resolvePickerGames } from "../../../domain/games/picker.js";
import playerAvatar from "../../../assets/player.svg";
import playerAvatarAlt from "../../../assets/player2.svg";
import pokerDieAceFace from "../../../assets/games/Poker Dice/die-Ace.svg";
import pokerDieKingFace from "../../../assets/games/Poker Dice/die-king.svg";
import pokerDieQueenFace from "../../../assets/games/Poker Dice/die-queen.svg";
import pokerDieJackFace from "../../../assets/games/Poker Dice/die-jack.svg";
import pokerDieTenFace from "../../../assets/games/Poker Dice/die-10.svg";
import pokerDieNineFace from "../../../assets/games/Poker Dice/die-9.svg";
import type { Player, RoomState, ScreenKey, ThemeKey } from "../../../types";
import {
  AvatarPickerGrid,
  Button,
  Card,
  CardHeader,
  HonorificToggle,
  PlayerCardShell,
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
import { useAppRouter } from "../../routing/AppRouter";
import { normalizeTargetScreen } from "../../routing/normalizeScreen";

const JOIN_CODE_LENGTH = 4;
const JOIN_CODE_DISALLOWED_CHARS_REGEX = /[IO]/g;
const LOCAL_REJOIN_KEY = "multipass_last_local_match";
const APP_MODE_STORAGE_KEY = "multipass_app_mode";
const LEGACY_COLLIDED_MODE_STORAGE_KEY = "multipass_mode";
const WORD_FIGHT_TURN_LIMIT_MS = 90_000;
const WIN_REASON_HIGHLIGHT_MS = 700;
const TTT_DRAG_ACTIVATION_PX = 10;
const TTT_CLICK_SUPPRESS_MS = 320;
const POKER_DICE_HAND_SIZE = 6;
const POKER_DICE_ROLL_DURATION_MS = 2000;
const POKER_DICE_SHUFFLE_MIN_MS = 80;
const POKER_DICE_SHUFFLE_MAX_MS = 120;
const POKER_DICE_ROLL_SPEED_MIN_MS = 480;
const POKER_DICE_ROLL_SPEED_MAX_MS = 620;
const POKER_DICE_ROLL_DELAY_MAX_MS = 140;
const POKER_DICE_SETTLE_MS = 220;
const POKER_DICE_PREROLL_READY_COPY = "Not rolled yet. Tap Roll to open this hand.";

const SETUP_SHEET_SCREENS = new Set<ScreenKey>(["local", "online", "host", "join"]);
const ROOM_REQUIRED_SCREENS = new Set<ScreenKey>(["lobby", "pick", "wait", "game", "pass", "winner"]);

type HonorificValue = "mr" | "mrs";
type LocalSetupStep = "p1" | "p2";
type AvatarId = "yellow" | "red" | "green" | "blue";

interface LocalPrivacyState {
  viewerPlayerId: string | null;
  pendingViewerPlayerId: string | null;
  stage: "visible" | "handoff";
  prompt: string;
}

interface LocalRejoinSnapshot {
  room: RoomState;
  localPrivacy?: Partial<LocalPrivacyState>;
  pokerDicePendingHolds?: number[];
}

interface WinRevealState {
  signature: string;
  boardId: "ttt" | "dots_boxes";
  indices: number[];
}

interface TttGestureState {
  activePointerId: number | null;
  previewIndex: number | null;
  startX: number;
  startY: number;
  isDragging: boolean;
  suppressClickUntil: number;
}

interface PokerProjectedHand {
  category: string;
}

interface PokerFxUiState {
  rollingIndices: number[];
  settlingIndices: number[];
  rollStyleByDie: Record<number, CSSProperties>;
  displayFacesByDie: Record<number, number>;
  waitingForResolution: boolean;
}

interface PokerFxInternalState {
  rollingIndices: Set<number>;
  intervalByIndex: Map<number, number>;
  rollProfileByIndex: Map<number, { shuffleOffset: number; speedMs: number; startDelayMs: number }>;
  shuffleCursorByIndex: Map<number, number>;
  lastShownFaceByIndex: Map<number, number>;
  settleUntilByIndex: Map<number, number>;
  stopTimeoutId: number | null;
  settleTimeoutId: number | null;
  pendingRollToken: number;
  activeRollToken: number;
  minEndAt: number;
  waitingForResolution: boolean;
  expectedRollsUsed: number | null;
  viewerPlayerId: string | null;
  baselineDiceKey: string;
}

interface AvatarOption {
  id: AvatarId;
  name: string;
  theme: ThemeKey;
}

const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "yellow", name: "Yellow", theme: "yellow" },
  { id: "red", name: "Red", theme: "red" },
  { id: "green", name: "Green", theme: "green" },
  { id: "blue", name: "Blue", theme: "blue" }
];

const POKER_DICE_FACE_VALUES = [1, 2, 3, 4, 5, 6];
const POKER_DICE_FACE_ASSETS = Object.freeze({
  1: Object.freeze({ label: "Ace", src: pokerDieAceFace }),
  2: Object.freeze({ label: "King", src: pokerDieKingFace }),
  3: Object.freeze({ label: "Queen", src: pokerDieQueenFace }),
  4: Object.freeze({ label: "Jack", src: pokerDieJackFace }),
  5: Object.freeze({ label: "10", src: pokerDieTenFace }),
  6: Object.freeze({ label: "9", src: pokerDieNineFace })
});

type LegacyBridgeState = {
  mode: "online" | "local";
  room: RoomState | null;
  you: { playerId: string | null; role: string | null } | null;
  localPrivacy: LocalPrivacyState;
};

let legacyBridgeState: LegacyBridgeState = {
  mode: "online",
  room: null,
  you: null,
  localPrivacy: createInitialLocalPrivacyState()
};

function getPokerDieFace(value: unknown): { label: string; src: string } | null {
  const normalized = Number(value);
  if (!Number.isInteger(normalized)) return null;
  return POKER_DICE_FACE_ASSETS[normalized as keyof typeof POKER_DICE_FACE_ASSETS] || null;
}

function buildPokerRollStyle(delayMs: number, speedMs: number): CSSProperties {
  return {
    "--pd-roll-delay-ms": `${Math.max(0, Math.round(delayMs))}ms`,
    "--pd-roll-speed-ms": `${Math.max(300, Math.round(speedMs))}ms`
  } as CSSProperties;
}

function getPokerDieFaceStyle(value: number): CSSProperties | undefined {
  const face = getPokerDieFace(value);
  if (!face) return undefined;
  return { "--poker-cube-face-image": `url("${face.src}")` } as CSSProperties;
}

function createInitialPokerFxUiState(): PokerFxUiState {
  return {
    rollingIndices: [],
    settlingIndices: [],
    rollStyleByDie: {},
    displayFacesByDie: {},
    waitingForResolution: false
  };
}

function createInitialPokerFxInternalState(): PokerFxInternalState {
  return {
    rollingIndices: new Set<number>(),
    intervalByIndex: new Map<number, number>(),
    rollProfileByIndex: new Map<number, { shuffleOffset: number; speedMs: number; startDelayMs: number }>(),
    shuffleCursorByIndex: new Map<number, number>(),
    lastShownFaceByIndex: new Map<number, number>(),
    settleUntilByIndex: new Map<number, number>(),
    stopTimeoutId: null,
    settleTimeoutId: null,
    pendingRollToken: 0,
    activeRollToken: 0,
    minEndAt: 0,
    waitingForResolution: false,
    expectedRollsUsed: null,
    viewerPlayerId: null,
    baselineDiceKey: ""
  };
}

function randomBetween(min: number, max: number): number {
  const low = Number(min);
  const high = Number(max);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return Math.round(low);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function getPokerDiceValuesKey(values: Array<number | null> = []): string {
  if (!Array.isArray(values) || !values.length) return "";
  return values
    .map((value) => (Number.isInteger(Number(value)) ? Number(value) : ""))
    .join(",");
}

const legacyBridgeListeners = new Set<(state: LegacyBridgeState, action: unknown) => void>();

function publishLegacyBridge(nextState: LegacyBridgeState) {
  legacyBridgeState = nextState;

  const currentStore = window.__multipassStore as
    | ({ __reactBridge?: boolean } & {
        getState: () => LegacyBridgeState;
        subscribe: (listener: (state: LegacyBridgeState, action: unknown) => void) => () => void;
      })
    | undefined;

  if (!currentStore || currentStore.__reactBridge !== true) {
    window.__multipassStore = {
      __reactBridge: true,
      getState() {
        return legacyBridgeState;
      },
      subscribe(listener) {
        legacyBridgeListeners.add(listener as (state: LegacyBridgeState, action: unknown) => void);
        return () => {
          legacyBridgeListeners.delete(listener as (state: LegacyBridgeState, action: unknown) => void);
        };
      }
    };
  }

  legacyBridgeListeners.forEach((listener) => {
    try {
      listener(nextState, { type: "REACT_RUNTIME_SYNC" });
    } catch {
      // Ignore listener failures from external debug hooks.
    }
  });

  window.__multipassLegacyReady = true;
}

function sanitizeJoinCode(rawCode: string): string {
  return normalizeRoomCode(rawCode)
    .replace(JOIN_CODE_DISALLOWED_CHARS_REGEX, "")
    .slice(0, JOIN_CODE_LENGTH);
}

function resolveScreenLayer(screen: ScreenKey): string {
  if (screen === "landing") return "landing";
  if (SETUP_SHEET_SCREENS.has(screen)) return "setup-sheet";
  if (screen === "devkit") return "devkit";
  return "game-space";
}

function resolveOnlineRoomScreen(room: RoomState | null): ScreenKey {
  return room?.game ? "game" : "lobby";
}

function formatStartedAgo(startedAt: number | null): string {
  if (!startedAt) return "Started a bit ago.";
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return "Started just now.";
  if (elapsedMinutes < 60) return `Started about ${elapsedMinutes} min ago.`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Started about ${elapsedHours} hr ago.`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Started about ${elapsedDays} day ago${elapsedDays === 1 ? "" : "s"}.`;
}

function normalizeHonorific(value: unknown): HonorificValue {
  return String(value || "").trim().toLowerCase() === "mrs" ? "mrs" : "mr";
}

function formatHonorificName(baseName: string, honorific: HonorificValue): string {
  return `${honorific === "mrs" ? "Mrs" : "Mr"} ${baseName}`;
}

function getPlayerArtSrc(honorific: HonorificValue): string {
  return honorific === "mrs" ? playerAvatarAlt : playerAvatar;
}

function getDisplayPlayerName(player: Player | null | undefined, fallback: string): string {
  const raw = String(player?.name || "").trim();
  return raw || fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isAvatarId(value: string | null | undefined): value is AvatarId {
  return value === "yellow" || value === "red" || value === "green" || value === "blue";
}

function getAvatarById(avatarId: AvatarId): AvatarOption {
  const found = AVATAR_OPTIONS.find((entry) => entry.id === avatarId);
  if (found) return found;
  return AVATAR_OPTIONS[0];
}

function resolveLocalViewerId(room: RoomState | null, currentViewerId: string | null): string | null {
  if (!room) return null;
  const players = [room.players.host, room.players.guest].filter(Boolean) as Player[];
  if (!players.length) return null;
  if (currentViewerId && players.some((player) => player.id === currentViewerId)) {
    return currentViewerId;
  }

  const stateGame = asRecord(room.game?.state);
  const nextPlayerId = typeof stateGame.nextPlayerId === "string" ? stateGame.nextPlayerId : null;
  if (nextPlayerId && players.some((player) => player.id === nextPlayerId)) {
    return nextPlayerId;
  }

  const firstPlayerId = typeof room.round?.firstPlayerId === "string" ? room.round.firstPlayerId : null;
  if (firstPlayerId && players.some((player) => player.id === firstPlayerId)) {
    return firstPlayerId;
  }

  return room.players.host?.id || players[0]?.id || null;
}

function playerById(room: RoomState | null, playerId: string | null): Player | null {
  if (!room || !playerId) return null;
  if (room.players.host?.id === playerId) return room.players.host;
  if (room.players.guest?.id === playerId) return room.players.guest;
  return null;
}

function getLeaderId(players: Array<Player | null>): string | null {
  const validPlayers = players.filter(Boolean) as Player[];
  if (!validPlayers.length) return null;

  const sorted = [...validPlayers].sort((left, right) => {
    const leftGamesWon = asNumber(left.gamesWon, 0);
    const rightGamesWon = asNumber(right.gamesWon, 0);
    if (leftGamesWon !== rightGamesWon) return rightGamesWon - leftGamesWon;
    const leftScore = asNumber(left.score, 0);
    const rightScore = asNumber(right.score, 0);
    return rightScore - leftScore;
  });

  const leader = sorted[0];
  const second = sorted[1] || null;
  if (!leader) return null;
  if (asNumber(leader.gamesWon, 0) <= 0) return null;
  if (second && asNumber(second.gamesWon, 0) === asNumber(leader.gamesWon, 0)) {
    return null;
  }
  return leader.id;
}

function getCountdownSecondsRemaining(countdownEndsAt: number | null, nowTick: number): number | null {
  if (!countdownEndsAt) return null;
  const msLeft = Math.max(0, countdownEndsAt - nowTick);
  if (msLeft <= 0) return 0;
  return Math.max(1, Math.ceil(msLeft / 1000));
}

function getGameBannerClass(gameId: string | null | undefined): string {
  const key = String(gameId || "").trim().toLowerCase();
  if (key === "dots_and_boxes" || key === "dots") return "game-banner-dots-and-boxes";
  if (key === "word_fight" || key === "words") return "game-banner-word-fight";
  if (key === "poker_dice" || key === "poker") return "game-banner-poker-dice";
  return "game-banner-tic-tac-toe";
}

function getGameName(room: RoomState | null, gameId: string | null): string {
  if (!room || !gameId) return "that game";
  const fromRoom = (room.games || []).find((game) => game.id === gameId)?.name;
  if (fromRoom) return fromRoom;
  const localGame = getLocalGame(gameId) as { name?: string } | null;
  return String(localGame?.name || gameId);
}

function createLocalRoom(
  avatarOneId: AvatarId,
  avatarTwoId: AvatarId,
  honorificOne: HonorificValue,
  honorificTwo: HonorificValue
): RoomState {
  const avatarOne = getAvatarById(avatarOneId);
  const avatarTwo = getAvatarById(avatarTwoId);

  const host: Player = {
    id: `player_${Math.random().toString(36).slice(2, 12)}`,
    name: formatHonorificName(avatarOne.name, honorificOne),
    honorific: honorificOne,
    theme: avatarOne.theme,
    role: "host",
    score: 0,
    gamesWon: 0,
    ready: true,
    connected: true
  };

  const guest: Player = {
    id: `player_${Math.random().toString(36).slice(2, 12)}`,
    name: formatHonorificName(avatarTwo.name, honorificTwo),
    honorific: honorificTwo,
    theme: avatarTwo.theme,
    role: "guest",
    score: 0,
    gamesWon: 0,
    ready: true,
    connected: true
  };

  return {
    code: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: {
      host,
      guest
    },
    round: {
      pickerId: null,
      firstPlayerId: null,
      shuffleAt: null,
      status: "waiting_game",
      hostGameId: null,
      guestGameId: null,
      resolvedGameId: null,
      countdownStartedAt: null,
      countdownEndsAt: null,
      hasPickedStarter: false
    },
    game: null,
    games: listLocalGames().map((game) => ({
      id: String(game.id),
      name: String(game.name),
      comingSoon: Boolean(game.comingSoon),
      bannerKey: typeof game.bannerKey === "string" ? game.bannerKey : undefined
    }))
  };
}

function getOtherLocalPlayerId(room: RoomState, currentPlayerId: string | null): string | null {
  const players = [room.players.host, room.players.guest].filter(Boolean) as Player[];
  const next = players.find((player) => player.id !== currentPlayerId);
  return next?.id || null;
}

function resolveNextLocalRoundStarter(room: RoomState): string | null {
  const hostId = room.players.host?.id || null;
  const currentStarter = room.round?.firstPlayerId || room.round?.pickerId || hostId;
  if (!currentStarter) return hostId;
  return getOtherLocalPlayerId(room, currentStarter) || hostId;
}

function getDisplayStateForRoomGame(
  room: RoomState | null,
  isLocalMode: boolean,
  viewerPlayerId: string | null
): Record<string, unknown> | null {
  if (!room?.game) return null;
  const fullState = asRecord(room.game.state);
  if (!isLocalMode) return fullState;

  const game = getLocalGame(room.game.id) as {
    visibility?: string;
    getVisibleState?: (state: Record<string, unknown>, viewer: string | null) => Record<string, unknown>;
  } | null;

  if (!game || game.visibility !== "hidden_pass_device" || typeof game.getVisibleState !== "function") {
    return fullState;
  }

  return game.getVisibleState(fullState, viewerPlayerId);
}

function getEndSignature(room: RoomState | null): string | null {
  if (!room?.game?.state) return null;
  const stateGame = asRecord(room.game.state);
  const winnerId = typeof stateGame.winnerId === "string" ? stateGame.winnerId : null;
  const isDraw = Boolean(stateGame.draw);
  if (!winnerId && !isDraw) return null;

  if (isDraw) {
    const historyLength = Array.isArray(stateGame.history) ? stateGame.history.length : 0;
    return `${room.code || "local"}:draw:${historyLength}`;
  }

  const winner = playerById(room, winnerId);
  if (!winner) return null;
  return `${room.code || "local"}:${winnerId}:${asNumber(winner.gamesWon, 0)}`;
}

function normalizeWinRevealReason(rawReason: unknown): WinRevealState | null {
  const reason = asRecord(rawReason);
  const boardIdRaw = typeof reason.boardId === "string" ? reason.boardId : null;
  if (boardIdRaw !== "ttt" && boardIdRaw !== "dots_boxes") return null;
  const indicesRaw = Array.isArray(reason.indices) ? reason.indices : [];
  const indices = [...new Set(indicesRaw.map((entry) => asNumber(entry, Number.NaN)).filter((entry) => Number.isInteger(entry) && entry >= 0))];
  if (!indices.length) return null;

  return {
    signature: "",
    boardId: boardIdRaw,
    indices
  };
}

function getWinRevealReason(room: RoomState | null): WinRevealState | null {
  if (!room?.game) return null;
  const game = getLocalGame(room.game.id) as {
    getWinRevealReason?: (state: Record<string, unknown>, context: unknown) => unknown;
  } | null;
  if (!game || typeof game.getWinRevealReason !== "function") return null;

  const rawReason = game.getWinRevealReason(asRecord(room.game.state), {
    room,
    players: room.players
  });
  return normalizeWinRevealReason(rawReason);
}

function getDotsGeometry(stateGame: Record<string, unknown>) {
  const dotCount = Math.max(2, asNumber(stateGame.dotCount, 6));
  const boxSpan = Math.max(1, dotCount - 1);
  const horizontalEdgeCount = dotCount * boxSpan;
  const totalBoxes = boxSpan * boxSpan;
  const gridSize = (dotCount * 2) - 1;
  return {
    dotCount,
    boxSpan,
    horizontalEdgeCount,
    totalBoxes,
    gridSize
  };
}

function getDotsBoxEdgeIndices(boxIndex: number, geometry: ReturnType<typeof getDotsGeometry>): [number, number, number, number] {
  const row = Math.floor(boxIndex / geometry.boxSpan);
  const col = boxIndex % geometry.boxSpan;
  const top = row * geometry.boxSpan + col;
  const bottom = (row + 1) * geometry.boxSpan + col;
  const left = geometry.horizontalEdgeCount + (row * geometry.dotCount) + col;
  const right = geometry.horizontalEdgeCount + (row * geometry.dotCount) + (col + 1);
  return [top, bottom, left, right];
}

function getDotsHotBoxIndices(stateGame: Record<string, unknown>, geometry: ReturnType<typeof getDotsGeometry>): number[] {
  const edges = Array.isArray(stateGame.edges) ? stateGame.edges : [];
  const boxes = Array.isArray(stateGame.boxes) ? stateGame.boxes : [];
  const hotIndices: number[] = [];

  for (let boxIndex = 0; boxIndex < geometry.totalBoxes; boxIndex += 1) {
    if (boxes[boxIndex]) continue;
    const edgeIndices = getDotsBoxEdgeIndices(boxIndex, geometry);
    const claimedCount = edgeIndices.reduce((count, edgeIndex) => (edges[edgeIndex] ? count + 1 : count), 0);
    if (claimedCount === 3) {
      hotIndices.push(boxIndex);
    }
  }

  return hotIndices;
}

function getDotsScoringEdgeIndices(
  stateGame: Record<string, unknown>,
  geometry: ReturnType<typeof getDotsGeometry>,
  hotBoxIndices: number[]
): Set<number> {
  const edges = Array.isArray(stateGame.edges) ? stateGame.edges : [];
  const scoring = new Set<number>();

  hotBoxIndices.forEach((boxIndex) => {
    const edgeIndices = getDotsBoxEdgeIndices(boxIndex, geometry);
    const missing = edgeIndices.find((edgeIndex) => !edges[edgeIndex]);
    if (missing !== undefined) {
      scoring.add(missing);
    }
  });

  return scoring;
}

function getLastDotsMoveEdgeIndex(stateGame: Record<string, unknown>): number | null {
  const history = Array.isArray(stateGame.history) ? stateGame.history : [];
  if (!history.length) return null;
  const last = asRecord(history[history.length - 1]);
  const edgeIndex = asNumber(last.edgeIndex, Number.NaN);
  return Number.isInteger(edgeIndex) ? edgeIndex : null;
}

function getWordFightTurnMsRemaining(stateGame: Record<string, unknown>, nowTick: number): number {
  const isFinished = Boolean(stateGame.winnerId || stateGame.draw || !stateGame.nextPlayerId);
  if (isFinished) return 0;
  const startedAt = asNumber(stateGame.turnStartedAt, nowTick);
  const elapsed = Math.max(0, nowTick - startedAt);
  return Math.max(0, WORD_FIGHT_TURN_LIMIT_MS - elapsed);
}

function formatWordFightTurnClock(msRemaining: number): string {
  const safeMs = Math.max(0, asNumber(msRemaining, 0));
  const totalSeconds = safeMs > 0 ? Math.ceil(safeMs / 1000) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resolveWordFightKeyboardState(entries: Array<Record<string, unknown>>): Record<string, "exact" | "present" | "absent"> {
  const rankByState: Record<string, number> = {
    absent: 1,
    present: 2,
    exact: 3
  };
  const stateByLetter: Record<string, "exact" | "present" | "absent"> = {};

  entries.forEach((entry) => {
    const guess = String(entry.guess || "");
    const feedback = Array.isArray(entry.feedback) ? entry.feedback : [];

    for (let index = 0; index < 4; index += 1) {
      const letter = String(guess[index] || "").toUpperCase();
      if (!/^[A-Z]$/.test(letter)) continue;
      const feedbackState = String(feedback[index] || "absent");
      if (feedbackState !== "exact" && feedbackState !== "present" && feedbackState !== "absent") continue;

      const current = stateByLetter[letter];
      if (!current || rankByState[feedbackState] > rankByState[current]) {
        stateByLetter[letter] = feedbackState;
      }
    }
  });

  return stateByLetter;
}

function classifyPokerProjection(diceValues: unknown): PokerProjectedHand | null {
  if (!Array.isArray(diceValues)) return null;
  const dice = diceValues
    .map((entry) => asNumber(entry, Number.NaN))
    .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 6);

  if (dice.length < POKER_DICE_HAND_SIZE) return null;

  const values = [...dice].sort((left, right) => right - left);
  const counts = new Map<number, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  const entries = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      return right.value - left.value;
    });

  const countPattern = entries.map((entry) => entry.count);
  const valueSet = new Set(values);
  const isRoyalFlush = [1, 2, 3, 4, 5].every((value) => valueSet.has(value));
  const isFlush = [2, 3, 4, 5, 6].every((value) => valueSet.has(value));
  const triple = entries.find((entry) => entry.count >= 3) || null;
  const pair = entries.find((entry) => entry.value !== triple?.value && entry.count >= 2) || null;

  if (isRoyalFlush) return { category: "royal_flush" };
  if (isFlush) return { category: "flush" };
  if ((countPattern[0] || 0) >= 5) return { category: "five_kind" };
  if ((countPattern[0] || 0) >= 4) return { category: "four_kind" };
  if (triple && pair) return { category: "full_house" };
  if ((countPattern[0] || 0) >= 3) return { category: "three_kind" };
  if ((countPattern[0] || 0) >= 2 && (countPattern[1] || 0) >= 2) return { category: "two_pair" };
  if ((countPattern[0] || 0) >= 2) return { category: "one_pair" };
  return { category: "high_card" };
}

function resolveLocalRoomScreen(
  room: RoomState | null,
  localPrivacy: LocalPrivacyState,
  pokerPassTargetPlayerId: string | null
): ScreenKey {
  if (!room) return "lobby";
  if (!room.game) return "lobby";

  const stateGame = asRecord(room.game.state);
  const finished = Boolean(stateGame.winnerId || stateGame.draw);
  if (finished) return "game";

  if (room.game.id === "poker_dice" && pokerPassTargetPlayerId) {
    return "game";
  }

  if (shouldShowLocalPassScreen(room, localPrivacy)) {
    if (room.game.id === "word_fight") return "game";
    if (room.game.id === "poker_dice") return "game";
    return "pass";
  }

  return "game";
}

function loadLocalRejoinSnapshot(): LocalRejoinSnapshot | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_REJOIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.room || typeof parsed.room !== "object") return null;
    return parsed as LocalRejoinSnapshot;
  } catch {
    return null;
  }
}

function saveLocalRejoinSnapshot(snapshot: LocalRejoinSnapshot | null) {
  try {
    if (!snapshot) {
      window.localStorage.removeItem(LOCAL_REJOIN_KEY);
      return;
    }
    window.localStorage.setItem(LOCAL_REJOIN_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence failures.
  }
}

interface SheetScreenProps extends PropsWithChildren {
  id: string;
  active?: boolean;
  className?: string;
  panelClassName?: string;
  onClose?: () => void;
}

function SheetScreen({
  id,
  active = false,
  className = "",
  panelClassName = "",
  onClose,
  children
}: SheetScreenProps) {
  const dragRef = useRef<{ pointerId: number | null; startY: number; lastY: number }>({
    pointerId: null,
    startY: 0,
    lastY: 0
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.lastY = event.clientY;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const deltaY = dragRef.current.lastY - dragRef.current.startY;
    dragRef.current.pointerId = null;
    if (deltaY >= 140) {
      onClose?.();
    }
  };

  return (
    <Screen id={id} className={`sheet-screen ${className}`.trim()} active={active}>
      <div
        className="sheet-backdrop"
        data-sheet-close="true"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="sheet-drag-rail"
        data-sheet-handle="true"
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="sheet-handle-pill" />
      </div>
      <div
        className={`sheet-panel ${panelClassName}`.trim()}
        data-sheet-panel="true"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {children}
      </div>
    </Screen>
  );
}

interface LocalAvatarGridProps {
  selectedAvatarId: string | null;
  localStep: LocalSetupStep;
  localAvatars: { one: string | null; two: string | null };
  localHonorifics: { p1: HonorificValue; p2: HonorificValue };
  onSelect: (avatarId: AvatarId) => void;
}

function LocalAvatarGrid({
  selectedAvatarId,
  localStep,
  localAvatars,
  localHonorifics,
  onSelect
}: LocalAvatarGridProps) {
  return (
    <div id="local-avatar-grid" className="avatar-picker local-avatar-grid">
      {AVATAR_OPTIONS.map((avatar) => {
        const isLocked = localStep === "p2" && localAvatars.one === avatar.id;
        const isSelected = selectedAvatarId === avatar.id;
        const tileHonorific = isLocked
          ? localHonorifics.p1
          : (localStep === "p1" ? localHonorifics.p1 : localHonorifics.p2);

        const tileName = formatHonorificName(avatar.name, tileHonorific);
        const tileArt = getPlayerArtSrc(tileHonorific);

        return (
          <button
            key={avatar.id}
            className={`avatar-option square-option theme-${avatar.theme}${isSelected ? " selected" : ""}${isLocked ? " p1-locked" : ""}`}
            data-avatar={avatar.id}
            data-selected={String(isSelected)}
            aria-pressed={isSelected}
            type="button"
            disabled={isLocked}
            onClick={() => onSelect(avatar.id)}
          >
            <PlayerCardShell
              variant="picker"
              themeClass={`theme-${avatar.theme}`}
              name={tileName}
              artSrc={tileArt}
              selected={isSelected && !isLocked}
              locked={isLocked}
            />
          </button>
        );
      })}
    </div>
  );
}

interface AppScreensProps {
  isDevBuild: boolean;
}

export function AppScreens({ isDevBuild }: AppScreensProps) {
  const { route, goTo } = useAppRouter();
  const {
    state,
    setMode,
    setJoinCode,
    setLastRoom,
    validateRoom,
    createRoom,
    joinRoom,
    send
  } = useRuntime();

  const [localStep, setLocalStep] = useState<LocalSetupStep>("p1");
  const [localAvatars, setLocalAvatars] = useState<{ one: string | null; two: string | null }>({
    one: null,
    two: null
  });
  const [localHonorifics, setLocalHonorifics] = useState<{ p1: HonorificValue; p2: HonorificValue }>({
    p1: "mr",
    p2: "mr"
  });
  const [hostAvatar, setHostAvatar] = useState<string | null>(null);
  const [hostHonorific, setHostHonorific] = useState<HonorificValue>("mr");
  const [joinAvatar, setJoinAvatar] = useState<string | null>(null);
  const [joinHonorific, setJoinHonorific] = useState<HonorificValue>("mr");
  const [localRoom, setLocalRoom] = useState<RoomState | null>(null);
  const [localPrivacy, setLocalPrivacy] = useState<LocalPrivacyState>(() => createInitialLocalPrivacyState());
  const [localRejoinSnapshot, setLocalRejoinSnapshot] = useState<LocalRejoinSnapshot | null>(() => loadLocalRejoinSnapshot());
  const [pokerDicePendingHolds, setPokerDicePendingHolds] = useState<number[]>([]);
  const [pokerFxUi, setPokerFxUi] = useState<PokerFxUiState>(() => createInitialPokerFxUiState());
  const [pokerProjectedGuideCategory, setPokerProjectedGuideCategory] = useState<string | null>(null);
  const [wordFightDraft, setWordFightDraft] = useState("");
  const [pokerPassTargetPlayerId, setPokerPassTargetPlayerId] = useState<string | null>(null);
  const [onlineBoardDismissed, setOnlineBoardDismissed] = useState(false);
  const [onlineLeavingToLanding, setOnlineLeavingToLanding] = useState(false);
  const [winReveal, setWinReveal] = useState<WinRevealState | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [closingSetupScreen, setClosingSetupScreen] = useState<ScreenKey | null>(null);

  const tttBoardRef = useRef<HTMLDivElement | null>(null);
  const tttGestureRef = useRef<TttGestureState>({
    activePointerId: null,
    previewIndex: null,
    startX: 0,
    startY: 0,
    isDragging: false,
    suppressClickUntil: 0
  });
  const pokerFxRef = useRef<PokerFxInternalState>(createInitialPokerFxInternalState());
  const pokerServerDiceRef = useRef<Array<number | null>>([]);
  const pokerServerRollsUsedRef = useRef(0);
  const pokerViewerPlayerRef = useRef<string | null>(null);

  const modeHydratedRef = useRef(false);
  const deepLinkValidationRef = useRef<string | null>(null);
  const previousOnlineHasGameRef = useRef(false);

  const isReactRuntime = state.runtimeMode === "react";

  const localViewerId = useMemo(
    () => resolveLocalViewerId(localRoom, localPrivacy.viewerPlayerId),
    [localPrivacy.viewerPlayerId, localRoom]
  );

  const isLocalMode = state.mode === "local";
  const activeRoom = isLocalMode ? localRoom : state.room;
  const activeYou = isLocalMode
    ? { playerId: localViewerId, role: "local" }
    : { playerId: state.you?.playerId || null, role: state.you?.role || null };

  const activeDisplayState = useMemo(
    () => getDisplayStateForRoomGame(activeRoom, isLocalMode, localViewerId),
    [activeRoom, isLocalMode, localViewerId]
  );

  const hasRoom = Boolean(activeRoom);
  const hasGame = Boolean(activeRoom?.game);

  const hasEndedGame = useMemo(() => {
    if (!activeDisplayState) return false;
    return Boolean(activeDisplayState.winnerId || activeDisplayState.draw);
  }, [activeDisplayState]);

  const resolvedRoomScreen = useMemo<ScreenKey>(() => {
    if (isLocalMode) {
      return resolveLocalRoomScreen(localRoom, localPrivacy, pokerPassTargetPlayerId);
    }
    return resolveOnlineRoomScreen(state.room);
  }, [isLocalMode, localPrivacy, localRoom, pokerPassTargetPlayerId, state.room]);

  const resolvedScreen = useMemo<ScreenKey>(() => {
    if (!isReactRuntime) return "landing";

    if (isLocalMode) {
      if (!localRoom) {
        if (ROOM_REQUIRED_SCREENS.has(route.screen)) return "landing";
        if (route.screen === "online" || route.screen === "host" || route.screen === "join") {
          return "landing";
        }
        return route.screen;
      }

      if (route.screen === "devkit") return "devkit";
      if (route.screen === "lobby") return "lobby";
      if (route.screen === "pick" || route.screen === "wait" || route.screen === "game" || route.screen === "pass" || route.screen === "winner") {
        return resolvedRoomScreen;
      }
      if (SETUP_SHEET_SCREENS.has(route.screen) || route.screen === "landing") return resolvedRoomScreen;
      return resolvedRoomScreen;
    }

    const normalized = normalizeTargetScreen(route.screen, {
      hasRoom,
      hasGame,
      hasEndedGame,
      resolvedScreen: resolvedRoomScreen
    });
    if (onlineLeavingToLanding) return "landing";

    const shouldAutoOpenOnlineGame = hasRoom && resolvedRoomScreen === "game" && !onlineBoardDismissed;
    if (hasRoom && (SETUP_SHEET_SCREENS.has(route.screen) || route.screen === "landing")) {
      return shouldAutoOpenOnlineGame ? "game" : "lobby";
    }
    if (route.screen === "lobby" && shouldAutoOpenOnlineGame) {
      return "game";
    }
    return normalized;
  }, [
    hasEndedGame,
    hasGame,
    hasRoom,
    isLocalMode,
    isReactRuntime,
    localRoom,
    onlineBoardDismissed,
    onlineLeavingToLanding,
    resolvedRoomScreen,
    route.screen
  ]);

  const activeScreen = isReactRuntime ? resolvedScreen : "landing";

  const normalizedJoinCode = sanitizeJoinCode(state.join.code);
  const joinStep = state.join.preview ? "avatar" : "code";
  const joinPreviewHost = state.join.preview?.host ?? null;
  const joinHostTheme = typeof joinPreviewHost?.theme === "string" ? joinPreviewHost.theme : null;
  const joinHostHonorific = normalizeHonorific(joinPreviewHost?.honorific || "mr");
  const joinHostAvatarId: AvatarId | null = isAvatarId(joinHostTheme) ? joinHostTheme : null;
  const joinHostAvatar = joinHostAvatarId ? getAvatarById(joinHostAvatarId) : null;
  const joinLockedAvatarLabel = (() => {
    const hostName = String(joinPreviewHost?.name || "").trim();
    if (hostName) return hostName;
    if (!joinHostAvatar) return null;
    return formatHonorificName(joinHostAvatar.name, joinHostHonorific);
  })();
  const joinLockedAvatarArtSrc = getPlayerArtSrc(joinHostHonorific);
  const joinStatusMessage = joinStep === "code"
    ? (state.join.status === "validating" ? "Checking room..." : state.join.message || "Enter 4-letter code")
    : "Pick your player";
  const joinDisabledAvatarIds = useMemo(() => {
    const next = new Set((state.join.preview?.takenThemes ?? []).map((theme) => String(theme)));
    if (joinHostAvatarId) next.add(joinHostAvatarId);
    return [...next];
  }, [joinHostAvatarId, state.join.preview?.takenThemes]);
  const joinCtaLabel = joinStep === "code"
    ? (state.join.status === "validating" ? "Checking..." : "Continue")
    : (state.join.preview?.canRejoin ? "Join room" : "Join room");
  const joinCtaDisabled = joinStep === "code"
    ? normalizedJoinCode.length !== JOIN_CODE_LENGTH || state.join.status === "validating"
    : (!joinAvatar && !state.join.preview?.canRejoin);

  const currentLocalAvatarId = localStep === "p1" ? localAvatars.one : localAvatars.two;
  const localCtaDisabled = !currentLocalAvatarId;
  const localCtaLabel = currentLocalAvatarId ? "Continue" : "Pick a player";

  const hasOnlineRejoin = !state.room && Boolean(state.lastRoomCode);
  const onlineRejoinCode = sanitizeJoinCode(state.lastRoomCode || "");
  const onlineRejoinStartedLabel = formatStartedAgo(state.lastRoomStartedAt);

  const hasLocalRejoin = !localRoom && Boolean(localRejoinSnapshot?.room);
  const localRejoinStartedAt = localRejoinSnapshot?.room?.createdAt || null;

  const activeGameId = activeRoom?.game?.id || null;
  const activeGameState = activeDisplayState ?? asRecord(activeRoom?.game?.state);
  const activeGameWinnerId = typeof activeGameState?.winnerId === "string" ? activeGameState.winnerId : null;
  const activeGameDraw = Boolean(activeGameState?.draw);

  const turnBarMode: "idle" | "turn" | "winner" | "draw" = useMemo(() => {
    if (!activeRoom?.game || !activeDisplayState) return "idle";
    if (activeDisplayState.winnerId) return "winner";
    if (activeDisplayState.draw) return "draw";
    return "turn";
  }, [activeDisplayState, activeRoom?.game]);

  const turnBarActivePlayerId = useMemo(() => {
    if (!activeDisplayState) return null;
    if (isLocalMode && localPrivacy.stage === "handoff" && activeGameId === "word_fight") {
      return localViewerId;
    }
    if (isLocalMode && activeGameId === "poker_dice" && pokerPassTargetPlayerId) {
      return localViewerId;
    }
    if (activeDisplayState.winnerId && typeof activeDisplayState.winnerId === "string") {
      return activeDisplayState.winnerId;
    }
    if (activeDisplayState.draw) return null;
    return typeof activeDisplayState.nextPlayerId === "string" ? activeDisplayState.nextPlayerId : null;
  }, [activeDisplayState, activeGameId, isLocalMode, localPrivacy.stage, localViewerId, pokerPassTargetPlayerId]);

  const lobbyGames = useMemo(() => {
    if (!activeRoom) return [];
    const resolved = resolvePickerGames(activeRoom.games || []);
    return [...resolved].sort((left, right) => {
      const leftSoon = Boolean(left.comingSoon);
      const rightSoon = Boolean(right.comingSoon);
      if (leftSoon === rightSoon) return 0;
      return leftSoon ? 1 : -1;
    });
  }, [activeRoom]);

  const onlineHostChoiceId = activeRoom?.round?.hostGameId || null;
  const onlineGuestChoiceId = activeRoom?.round?.guestGameId || null;
  const resolvedChoiceId = activeRoom?.round?.resolvedGameId || null;
  const onlineCountdownActive = Boolean(
    !isLocalMode
    && activeRoom?.round?.status === "countdown"
    && resolvedChoiceId
    && activeRoom?.round?.countdownEndsAt
  );

  const onlineCountdownSeconds = useMemo(() => {
    if (!onlineCountdownActive) return null;
    return getCountdownSecondsRemaining(asNumber(activeRoom?.round?.countdownEndsAt, 0), clockTick);
  }, [activeRoom?.round?.countdownEndsAt, clockTick, onlineCountdownActive]);

  const shouldTick = useMemo(() => {
    const wordFightTick = activeScreen === "game"
      && activeGameId === "word_fight"
      && Boolean(activeDisplayState?.nextPlayerId)
      && !activeGameWinnerId
      && !activeGameDraw;

    const lobbyCountdownTick = activeScreen === "lobby" && onlineCountdownActive;
    return wordFightTick || lobbyCountdownTick;
  }, [
    activeDisplayState?.nextPlayerId,
    activeGameDraw,
    activeGameId,
    activeGameWinnerId,
    activeScreen,
    onlineCountdownActive
  ]);

  useEffect(() => {
    if (!shouldTick) return;
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 250);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [shouldTick]);

  useEffect(() => {
    if (!isReactRuntime) return;
    if (route.screen === resolvedScreen) return;
    goTo(resolvedScreen, { replace: true });
  }, [goTo, isReactRuntime, resolvedScreen, route.screen]);

  useEffect(() => {
    if (!isReactRuntime) return;
    document.body.dataset.screen = resolvedScreen;
    document.body.dataset.layer = resolveScreenLayer(resolvedScreen);
  }, [isReactRuntime, resolvedScreen]);

  useEffect(() => {
    if (!isReactRuntime || modeHydratedRef.current) return;
    modeHydratedRef.current = true;
    try {
      const storedMode = window.localStorage.getItem(APP_MODE_STORAGE_KEY);
      if (storedMode === "local" || storedMode === "online") {
        setMode(storedMode);
        return;
      }

      const legacyStoredMode = window.localStorage.getItem(LEGACY_COLLIDED_MODE_STORAGE_KEY);
      if (legacyStoredMode === "local" || legacyStoredMode === "online") {
        setMode(legacyStoredMode);
        window.localStorage.setItem(APP_MODE_STORAGE_KEY, legacyStoredMode);
        window.localStorage.removeItem(LEGACY_COLLIDED_MODE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [isReactRuntime, setMode]);

  useEffect(() => {
    if (!isReactRuntime) return;
    try {
      window.localStorage.setItem(APP_MODE_STORAGE_KEY, state.mode);
    } catch {
      // Ignore storage failures.
    }
  }, [isReactRuntime, state.mode]);

  useEffect(() => {
    if (!isReactRuntime) return;
    if (isLocalMode) {
      setOnlineBoardDismissed(false);
      setOnlineLeavingToLanding(false);
      previousOnlineHasGameRef.current = false;
      return;
    }

    const hasOnlineGame = Boolean(state.room?.game);
    if (!state.room) {
      setOnlineBoardDismissed(false);
      setOnlineLeavingToLanding(false);
      previousOnlineHasGameRef.current = false;
      return;
    }

    if (!previousOnlineHasGameRef.current && hasOnlineGame) {
      setOnlineBoardDismissed(false);
    }
    if (!hasOnlineGame) {
      setOnlineBoardDismissed(false);
    }
    previousOnlineHasGameRef.current = hasOnlineGame;
  }, [isLocalMode, isReactRuntime, state.room]);

  useEffect(() => {
    if (!isReactRuntime || !onlineLeavingToLanding) return;
    if (!state.room) {
      setOnlineLeavingToLanding(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setOnlineLeavingToLanding(false);
    }, 1200);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isReactRuntime, onlineLeavingToLanding, state.room]);

  useEffect(() => {
    if (!isReactRuntime || !isLocalMode || !localRoom) return;
    if (localViewerId && localPrivacy.viewerPlayerId !== localViewerId) {
      setLocalPrivacy((previous) => ({
        ...previous,
        viewerPlayerId: localViewerId
      }));
    }
  }, [isLocalMode, isReactRuntime, localPrivacy.viewerPlayerId, localRoom, localViewerId]);

  useEffect(() => {
    if (!isReactRuntime || !isLocalMode || !localRoom) return;
    const snapshot: LocalRejoinSnapshot = {
      room: localRoom,
      localPrivacy,
      pokerDicePendingHolds
    };
    setLocalRejoinSnapshot(snapshot);
    saveLocalRejoinSnapshot(snapshot);
  }, [isLocalMode, isReactRuntime, localPrivacy, localRoom, pokerDicePendingHolds]);

  useEffect(() => {
    if (!isReactRuntime) return;
    if (route.screen !== "join") {
      deepLinkValidationRef.current = null;
      return;
    }

    const joinCode = sanitizeJoinCode(route.join.code || "");
    if (joinCode.length !== JOIN_CODE_LENGTH) return;

    if (joinCode !== normalizedJoinCode) {
      setJoinCode(joinCode);
    }

    if (deepLinkValidationRef.current === joinCode) return;
    validateRoom(joinCode);
    deepLinkValidationRef.current = joinCode;
  }, [isReactRuntime, normalizedJoinCode, route.join.code, route.screen, setJoinCode, validateRoom]);

  useEffect(() => {
    if (!joinAvatar) return;
    if (!joinDisabledAvatarIds.includes(joinAvatar)) return;
    setJoinAvatar(null);
  }, [joinAvatar, joinDisabledAvatarIds]);

  useEffect(() => {
    if (!isReactRuntime) return;
    const signature = getEndSignature(activeRoom);
    if (!signature) {
      setWinReveal(null);
      return;
    }

    if (winReveal?.signature === signature) return;

    const reason = getWinRevealReason(activeRoom);
    if (!reason) {
      setWinReveal(null);
      return;
    }

    const nextReveal: WinRevealState = {
      ...reason,
      signature
    };
    setWinReveal(nextReveal);

    const timeoutId = window.setTimeout(() => {
      setWinReveal((current) => (current?.signature === signature ? null : current));
    }, WIN_REASON_HIGHLIGHT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeRoom, isReactRuntime]);

  useEffect(() => {
    if (!isReactRuntime) return;
    const localPrivacySnapshot = isLocalMode ? localPrivacy : createInitialLocalPrivacyState();
    publishLegacyBridge({
      mode: state.mode,
      room: activeRoom,
      you: activeYou,
      localPrivacy: {
        viewerPlayerId: localPrivacySnapshot.viewerPlayerId || null,
        pendingViewerPlayerId: localPrivacySnapshot.pendingViewerPlayerId || null,
        stage: localPrivacySnapshot.stage === "handoff" ? "handoff" : "visible",
        prompt: String(localPrivacySnapshot.prompt || "")
      }
    });
  }, [activeRoom, activeYou, isLocalMode, isReactRuntime, localPrivacy, state.mode]);

  useEffect(() => {
    if (!isReactRuntime) return;

    const footer = document.getElementById("app-fixed-footer");
    if (!(footer instanceof HTMLElement)) return;

    const slotIdByScreen: Partial<Record<ScreenKey, string>> = {
      local: "app-dock-slot-local",
      host: "app-dock-slot-host",
      join: "app-dock-slot-join",
      winner: "app-dock-slot-winner"
    };

    const nextSlotId = slotIdByScreen[activeScreen] ?? null;
    const allSlots = Array.from(footer.querySelectorAll<HTMLElement>(".app-fixed-footer-slot"));
    allSlots.forEach((slot) => slot.classList.add("hidden"));

    if (!nextSlotId) {
      footer.classList.add("hidden");
      footer.setAttribute("aria-hidden", "true");
      document.body.dataset.fixedFooterActive = "false";
      return;
    }

    const activeSlot = document.getElementById(nextSlotId);
    if (activeSlot instanceof HTMLElement) {
      activeSlot.classList.remove("hidden");
    }

    syncDockFromSourceButtons();
    footer.classList.remove("hidden");
    footer.setAttribute("aria-hidden", "false");
    document.body.dataset.fixedFooterActive = "true";
  }, [
    activeScreen,
    isReactRuntime,
    joinCtaDisabled,
    joinCtaLabel,
    localCtaDisabled,
    localCtaLabel
  ]);

  useEffect(() => {
    if (!isReactRuntime) return;

    const settingsButton = document.getElementById("open-settings");
    const settingsIcon = settingsButton?.querySelector(".settings-icon");
    const settingsLabel = document.getElementById("open-settings-label");
    const heroCenterTitle = document.getElementById("lobby-games-title");
    const logo = document.querySelector(".logo");
    const logoImage = document.querySelector(".logo .logo-image");
    const leftAction = document.getElementById("hero-left-action");

    const showHomeChrome = activeScreen === "landing" || SETUP_SHEET_SCREENS.has(activeScreen);
    const showLobbyHome = activeScreen === "lobby";

    if (settingsButton instanceof HTMLElement) {
      settingsButton.classList.toggle("hidden", !(showHomeChrome || showLobbyHome));
      settingsButton.classList.remove("hero-nav-link");
      settingsButton.dataset.navMode = "settings";
      settingsButton.setAttribute("aria-label", "Open settings");
    }

    if (settingsLabel instanceof HTMLElement) {
      settingsLabel.textContent = "";
    }

    if (settingsIcon instanceof HTMLElement) {
      settingsIcon.classList.remove("hidden");
    }

    if (heroCenterTitle instanceof HTMLElement) {
      heroCenterTitle.classList.add("hidden");
    }

    const showLogo = showHomeChrome || showLobbyHome;
    if (logo instanceof HTMLElement) {
      logo.classList.toggle("hidden", !showLogo);
    }

    if (logoImage instanceof HTMLElement) {
      logoImage.classList.toggle("hidden", showLobbyHome);
    }

    if (leftAction instanceof HTMLButtonElement) {
      leftAction.classList.add("hidden");
      leftAction.classList.remove("hero-action-home");
      leftAction.disabled = false;
      leftAction.onclick = null;
      leftAction.textContent = "";

      if (showLobbyHome) {
        leftAction.classList.remove("hidden");
        leftAction.classList.add("hero-action-home");
        leftAction.innerHTML = `
          <svg class="hero-home-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3.4 3 11v9.2c0 .2.2.4.4.4h6.2a.4.4 0 0 0 .4-.4v-5.6h4v5.6c0 .2.2.4.4.4h6.2c.2 0 .4-.2.4-.4V11z" fill="currentColor" />
          </svg>
          <span class="hero-action-label">Home</span>
        `.trim();
        leftAction.onclick = () => {
          if (isLocalMode) {
            setMode("online");
            setLocalRoom(null);
            setLocalPrivacy(createInitialLocalPrivacyState());
            setPokerPassTargetPlayerId(null);
            setWordFightDraft("");
            goTo("landing", { replace: false });
            return;
          }
          send({ type: "leave_room" });
          setOnlineLeavingToLanding(true);
          setOnlineBoardDismissed(false);
          goTo("landing", { replace: false });
        };
      }
    }
  }, [activeScreen, goTo, isLocalMode, isReactRuntime, send, setMode]);

  const closeSetupSheet = useCallback((screen: ScreenKey) => {
    if (!isReactRuntime) return;
    setClosingSetupScreen(screen);
    window.setTimeout(() => {
      goTo("landing");
      setClosingSetupScreen(null);
    }, 220);
  }, [goTo, isReactRuntime]);

  const persistLocalSnapshot = useCallback((room: RoomState, privacy: LocalPrivacyState, pendingHolds: number[]) => {
    const snapshot: LocalRejoinSnapshot = {
      room,
      localPrivacy: privacy,
      pokerDicePendingHolds: pendingHolds
    };
    setLocalRejoinSnapshot(snapshot);
    saveLocalRejoinSnapshot(snapshot);
  }, []);

  const updateLocalRoomState = useCallback((nextRoom: RoomState, nextPrivacy: LocalPrivacyState, pendingHolds: number[]) => {
    setLocalRoom(nextRoom);
    setLocalPrivacy(nextPrivacy);
    setPokerDicePendingHolds(pendingHolds);
    persistLocalSnapshot(nextRoom, nextPrivacy, pendingHolds);
  }, [persistLocalSnapshot]);

  const canActOnTurn = useCallback((nextPlayerId: string | null) => {
    if (!nextPlayerId) return false;
    if (isLocalMode) {
      if (localPrivacy.stage === "handoff") return false;
      if (activeGameId === "poker_dice" && pokerPassTargetPlayerId) return false;
      return true;
    }

    const isPlayerRole = activeYou.role === "host" || activeYou.role === "guest";
    if (!isPlayerRole) return false;
    return activeYou.playerId === nextPlayerId;
  }, [activeGameId, activeYou.playerId, activeYou.role, isLocalMode, localPrivacy.stage, pokerPassTargetPlayerId]);

  const applyLocalMove = useCallback((move: Record<string, unknown>) => {
    if (!localRoom?.game) return false;

    const game = getLocalGame(localRoom.game.id) as {
      visibility?: string;
      applyMove?: (
        stateInput: Record<string, unknown>,
        moveInput: Record<string, unknown>,
        playerId: string
      ) => { state: Record<string, unknown> } | { error: string };
    } | null;

    if (!game || typeof game.applyMove !== "function") return false;

    const currentState = asRecord(localRoom.game.state);
    const actingPlayerId = typeof currentState.nextPlayerId === "string" ? currentState.nextPlayerId : null;
    if (!actingPlayerId) return false;

    const previousWinnerId = typeof currentState.winnerId === "string" ? currentState.winnerId : null;

    const result = game.applyMove(currentState, move, actingPlayerId);
    if (!result || typeof result !== "object" || !("state" in result)) {
      return false;
    }

    const nextState = asRecord(result.state);
    const nextRoom: RoomState = {
      ...localRoom,
      updatedAt: Date.now(),
      game: {
        ...localRoom.game,
        state: nextState
      }
    };

    const nextWinnerId = typeof nextState.winnerId === "string" ? nextState.winnerId : null;
    if (!previousWinnerId && nextWinnerId) {
      if (nextRoom.players.host?.id === nextWinnerId) {
        nextRoom.players.host = {
          ...nextRoom.players.host,
          score: asNumber(nextRoom.players.host.score, 0) + 1,
          gamesWon: asNumber(nextRoom.players.host.gamesWon, 0) + 1
        };
      }
      if (nextRoom.players.guest?.id === nextWinnerId) {
        nextRoom.players.guest = {
          ...nextRoom.players.guest,
          score: asNumber(nextRoom.players.guest.score, 0) + 1,
          gamesWon: asNumber(nextRoom.players.guest.gamesWon, 0) + 1
        };
      }
    }

    let nextPrivacy = localPrivacy;
    let nextPokerPassTarget = pokerPassTargetPlayerId;

    const hasEnded = Boolean(nextState.winnerId || nextState.draw);
    const nextPlayerId = typeof nextState.nextPlayerId === "string" ? nextState.nextPlayerId : null;
    const didTurnChange = Boolean(nextPlayerId && nextPlayerId !== actingPlayerId);

    if (game.visibility === "hidden_pass_device") {
      if (nextRoom.game?.id === "poker_dice") {
        if (hasEnded) {
          nextPrivacy = queueLocalHandoff(nextPrivacy, {
            nextViewerPlayerId: null,
            prompt: ""
          });
          nextPokerPassTarget = null;
        } else if (didTurnChange) {
          nextPokerPassTarget = nextPlayerId;
          nextPrivacy = {
            ...nextPrivacy,
            stage: "visible",
            pendingViewerPlayerId: null,
            prompt: ""
          };
        } else {
          nextPokerPassTarget = null;
        }
      } else if (hasEnded) {
        nextPrivacy = queueLocalHandoff(nextPrivacy, {
          nextViewerPlayerId: null,
          prompt: ""
        });
        nextPokerPassTarget = null;
      } else {
        const nextPlayer = playerById(nextRoom, nextPlayerId);
        nextPrivacy = queueLocalHandoff(nextPrivacy, {
          nextViewerPlayerId: nextPlayerId,
          prompt: `Pass now to ${getDisplayPlayerName(nextPlayer, "next player")}.`
        });
        nextPokerPassTarget = null;
      }
    } else {
      nextPokerPassTarget = null;
    }

    setPokerPassTargetPlayerId(nextPokerPassTarget);
    setWordFightDraft("");
    updateLocalRoomState(nextRoom, nextPrivacy, []);

    const nextScreen = resolveLocalRoomScreen(nextRoom, nextPrivacy, nextPokerPassTarget);

    goTo(nextScreen, { replace: nextScreen !== "game" });
    return true;
  }, [
    goTo,
    localPrivacy,
    localRoom,
    pokerPassTargetPlayerId,
    updateLocalRoomState
  ]);

  const sendMove = useCallback((move: Record<string, unknown>) => {
    if (isLocalMode) {
      return applyLocalMove(move);
    }

    if (!state.room?.game?.id) return false;
    return send({
      type: "move",
      gameId: state.room.game.id,
      move
    });
  }, [applyLocalMove, isLocalMode, send, state.room?.game?.id]);

  const startLocalRoundFromChoice = useCallback((gameId: string) => {
    if (!localRoom) return;

    const game = getLocalGame(gameId) as {
      id: string;
      name: string;
      comingSoon?: boolean;
      visibility?: string;
      init?: (players: Array<{ id: string }>) => Record<string, unknown>;
    } | null;

    if (!game || game.comingSoon || typeof game.init !== "function") return;

    const players = [localRoom.players.host, localRoom.players.guest].filter(Boolean) as Player[];
    const firstPlayerId = localRoom.round?.firstPlayerId || players[0]?.id || null;

    const orderedPlayers = (() => {
      const first = players.find((player) => player.id === firstPlayerId) || players[0];
      if (!first) return players;
      return [first, ...players.filter((player) => player.id !== first.id)];
    })();

    const nextState = game.init(orderedPlayers);

    const nextRound = {
      pickerId: firstPlayerId,
      firstPlayerId,
      shuffleAt: null,
      status: "playing" as const,
      hostGameId: game.id,
      guestGameId: game.id,
      resolvedGameId: game.id,
      countdownStartedAt: null,
      countdownEndsAt: null,
      hasPickedStarter: Boolean(firstPlayerId)
    };

    const nextRoom: RoomState = {
      ...localRoom,
      updatedAt: Date.now(),
      round: nextRound,
      game: {
        id: game.id,
        name: game.name,
        state: nextState
      }
    };

    const nextViewer = resolveLocalViewerId(nextRoom, localPrivacy.viewerPlayerId);
    const nextPrivacy = game.visibility === "hidden_pass_device"
      ? createInitialLocalPrivacyState(nextViewer)
      : createInitialLocalPrivacyState(nextViewer);

    setPokerPassTargetPlayerId(null);
    setWordFightDraft("");
    updateLocalRoomState(nextRoom, nextPrivacy, []);
    goTo("game", { replace: false });
  }, [goTo, localPrivacy.viewerPlayerId, localRoom, updateLocalRoomState]);

  const startNextLocalRound = useCallback(() => {
    if (!localRoom) return;

    const nextStarterId = resolveNextLocalRoundStarter(localRoom);
    const nextRoom: RoomState = {
      ...localRoom,
      updatedAt: Date.now(),
      game: null,
      round: {
        pickerId: nextStarterId,
        firstPlayerId: nextStarterId,
        shuffleAt: null,
        status: "waiting_game",
        hostGameId: null,
        guestGameId: null,
        resolvedGameId: null,
        countdownStartedAt: null,
        countdownEndsAt: null,
        hasPickedStarter: Boolean(nextStarterId)
      }
    };

    setPokerPassTargetPlayerId(null);
    setWordFightDraft("");
    const nextPrivacy = createInitialLocalPrivacyState(nextStarterId);
    updateLocalRoomState(nextRoom, nextPrivacy, []);
    goTo("lobby", { replace: false });
  }, [goTo, localRoom, updateLocalRoomState]);

  const handleJoinCodeChange = isReactRuntime ? (code: string) => {
    deepLinkValidationRef.current = null;
    setJoinCode(code);
  } : undefined;

  const handleJoinCodeComplete = isReactRuntime ? (code: string) => {
    if (code.length !== JOIN_CODE_LENGTH) return;
    validateRoom(code);
  } : undefined;

  const handleJoinPrimaryAction = isReactRuntime ? () => {
    if (joinStep === "code") {
      if (normalizedJoinCode.length !== JOIN_CODE_LENGTH || state.join.status === "validating") return;
      validateRoom(normalizedJoinCode);
      return;
    }

    if (!joinAvatar && !state.join.preview?.canRejoin) return;
    joinRoom(normalizedJoinCode, joinAvatar, joinHonorific);
  } : undefined;

  const handleRejoin = isReactRuntime ? () => {
    if (onlineRejoinCode.length !== JOIN_CODE_LENGTH) return;
    setJoinCode(onlineRejoinCode);
    deepLinkValidationRef.current = onlineRejoinCode;
    validateRoom(onlineRejoinCode);
    setMode("online");
    goTo("join");
  } : undefined;

  const handleClearRejoin = isReactRuntime ? () => {
    setLastRoom(null, null);
  } : undefined;

  const handleLocalRejoin = isReactRuntime ? () => {
    if (!localRejoinSnapshot?.room) return;

    const rejoinedRoom = localRejoinSnapshot.room;
    const nextViewer = resolveLocalViewerId(
      rejoinedRoom,
      localRejoinSnapshot.localPrivacy?.viewerPlayerId || null
    );

    const nextPrivacy: LocalPrivacyState = {
      ...createInitialLocalPrivacyState(nextViewer),
      ...asRecord(localRejoinSnapshot.localPrivacy)
    } as LocalPrivacyState;

    nextPrivacy.stage = nextPrivacy.stage === "handoff" ? "handoff" : "visible";

    const holds = Array.isArray(localRejoinSnapshot.pokerDicePendingHolds)
      ? localRejoinSnapshot.pokerDicePendingHolds
        .map((entry) => asNumber(entry, Number.NaN))
        .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < POKER_DICE_HAND_SIZE)
      : [];

    setMode("local");
    setPokerPassTargetPlayerId(null);
    setWordFightDraft("");
    updateLocalRoomState(rejoinedRoom, nextPrivacy, holds);
    goTo(resolveLocalRoomScreen(rejoinedRoom, nextPrivacy, null), { replace: false });
  } : undefined;

  const handleClearLocalRejoin = isReactRuntime ? () => {
    setLocalRejoinSnapshot(null);
    saveLocalRejoinSnapshot(null);
  } : undefined;

  const handleLocalContinue = isReactRuntime ? () => {
    if (!isAvatarId(currentLocalAvatarId)) return;

    if (localStep === "p1") {
      setLocalStep("p2");
      return;
    }

    if (!isAvatarId(localAvatars.one) || !isAvatarId(localAvatars.two)) return;

    const room = createLocalRoom(
      localAvatars.one,
      localAvatars.two,
      localHonorifics.p1,
      localHonorifics.p2
    );

    const viewer = resolveLocalViewerId(room, room.players.host?.id || null);
    const privacy = createInitialLocalPrivacyState(viewer);

    setMode("local");
    setLocalStep("p1");
    setPokerPassTargetPlayerId(null);
    setWordFightDraft("");
    updateLocalRoomState(room, privacy, []);
    goTo("lobby", { replace: true });
  } : undefined;

  const handleSelectLobbyGame = useCallback((gameId: string) => {
    if (!activeRoom) return;

    const gameActive = Boolean(activeRoom.game && !activeGameWinnerId && !activeGameDraw);
    if (gameActive && activeRoom.game?.id !== gameId) return;

    if (activeRoom.game?.id === gameId && gameActive) {
      setOnlineBoardDismissed(false);
      goTo("game", { replace: false });
      return;
    }

    if (isLocalMode) {
      startLocalRoundFromChoice(gameId);
      return;
    }

    setOnlineBoardDismissed(false);
    send({ type: "select_game", gameId });
  }, [
    activeGameDraw,
    activeGameWinnerId,
    activeRoom,
    goTo,
    isLocalMode,
    send,
    setOnlineBoardDismissed,
    startLocalRoundFromChoice
  ]);

  const handleNewRound = useCallback(() => {
    if (isLocalMode) {
      startNextLocalRound();
      return;
    }
    setOnlineBoardDismissed(false);
    send({ type: "new_round" });
  }, [isLocalMode, send, startNextLocalRound]);

  const handleEndGame = useCallback(() => {
    if (!activeRoom || isLocalMode) return;
    const requesterId = typeof asRecord(activeRoom.endRequest).byId === "string"
      ? String(asRecord(activeRoom.endRequest).byId)
      : null;

    if (requesterId && requesterId !== activeYou.playerId) {
      send({ type: "end_game_agree" });
      return;
    }

    send({ type: "end_game_request" });
  }, [activeRoom, activeYou.playerId, isLocalMode, send]);

  const handleCloseBoard = useCallback(() => {
    if (!isLocalMode) {
      setOnlineBoardDismissed(true);
    }
    goTo("lobby", { replace: false });
  }, [goTo, isLocalMode]);

  const acknowledgePass = useCallback(() => {
    if (!isLocalMode || !localRoom) return;

    if (pokerPassTargetPlayerId) {
      const nextPrivacy: LocalPrivacyState = {
        ...localPrivacy,
        viewerPlayerId: pokerPassTargetPlayerId,
        pendingViewerPlayerId: null,
        stage: "visible",
        prompt: ""
      };
      setPokerPassTargetPlayerId(null);
      updateLocalRoomState(localRoom, nextPrivacy, []);
      goTo("game", { replace: true });
      return;
    }

    if (localPrivacy.stage !== "handoff") return;

    const nextPrivacy = confirmLocalHandoff(localPrivacy);
    updateLocalRoomState(localRoom, nextPrivacy, []);
    goTo("game", { replace: true });
  }, [
    goTo,
    isLocalMode,
    localPrivacy,
    localRoom,
    pokerPassTargetPlayerId,
    updateLocalRoomState
  ]);

  const tttState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "tic_tac_toe") return null;
    return asRecord(activeDisplayState ?? activeRoom.game.state);
  }, [activeDisplayState, activeRoom]);

  const dotsState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "dots_and_boxes") return null;
    return asRecord(activeDisplayState ?? activeRoom.game.state);
  }, [activeDisplayState, activeRoom]);

  const wordFightState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "word_fight") return null;
    return asRecord(activeDisplayState ?? activeRoom.game.state);
  }, [activeDisplayState, activeRoom]);

  const pokerState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "poker_dice") return null;
    return asRecord(activeDisplayState ?? activeRoom.game.state);
  }, [activeDisplayState, activeRoom]);

  const isTicTacToeCellPlayable = useCallback((index: number) => {
    if (!tttState) return false;
    if (activeGameWinnerId || activeGameDraw) return false;

    const board = Array.isArray(tttState.board) ? tttState.board : [];
    if (index < 0 || index >= board.length) return false;
    if (board[index] !== null && board[index] !== undefined) return false;

    const nextPlayerId = typeof tttState.nextPlayerId === "string" ? tttState.nextPlayerId : null;
    return canActOnTurn(nextPlayerId);
  }, [activeGameDraw, activeGameWinnerId, canActOnTurn, tttState]);

  const getTttIndexFromTarget = useCallback((target: EventTarget | null): number | null => {
    if (!(target instanceof Element)) return null;
    const board = tttBoardRef.current;
    if (!board) return null;
    const cell = target.closest(".ttt-cell");
    if (!(cell instanceof HTMLElement)) return null;
    if (!board.contains(cell)) return null;
    const index = asNumber(cell.dataset.index, Number.NaN);
    return Number.isInteger(index) ? index : null;
  }, []);

  const getTttIndexFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const board = tttBoardRef.current;
    if (!board) return null;
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof Element)) return null;
    const cell = target.closest(".ttt-cell");
    if (!(cell instanceof HTMLElement) || !board.contains(cell)) return null;
    const index = asNumber(cell.dataset.index, Number.NaN);
    return Number.isInteger(index) ? index : null;
  }, []);

  const commitTttMove = useCallback((index: number) => {
    if (!Number.isInteger(index)) return false;
    if (!isTicTacToeCellPlayable(index)) return false;
    return sendMove({ index });
  }, [isTicTacToeCellPlayable, sendMove]);

  const handleTttPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (tttGestureRef.current.activePointerId !== null) return;

    const index = getTttIndexFromTarget(event.target);
    if (index === null || !isTicTacToeCellPlayable(index)) return;

    tttGestureRef.current.activePointerId = event.pointerId;
    tttGestureRef.current.previewIndex = index;
    tttGestureRef.current.startX = event.clientX;
    tttGestureRef.current.startY = event.clientY;
    tttGestureRef.current.isDragging = false;

    if (tttBoardRef.current && typeof tttBoardRef.current.setPointerCapture === "function") {
      try {
        tttBoardRef.current.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture failures.
      }
    }
  }, [getTttIndexFromTarget, isTicTacToeCellPlayable]);

  const handleTttPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (tttGestureRef.current.activePointerId !== event.pointerId) return;

    const deltaX = event.clientX - tttGestureRef.current.startX;
    const deltaY = event.clientY - tttGestureRef.current.startY;
    if (!tttGestureRef.current.isDragging && Math.hypot(deltaX, deltaY) >= TTT_DRAG_ACTIVATION_PX) {
      tttGestureRef.current.isDragging = true;
    }

    const hoveredIndex = getTttIndexFromPoint(event.clientX, event.clientY);
    if (hoveredIndex !== null && isTicTacToeCellPlayable(hoveredIndex)) {
      tttGestureRef.current.previewIndex = hoveredIndex;
    } else {
      tttGestureRef.current.previewIndex = null;
    }

    if (event.pointerType !== "mouse" && event.cancelable && tttGestureRef.current.isDragging) {
      event.preventDefault();
    }
  }, [getTttIndexFromPoint, isTicTacToeCellPlayable]);

  const clearTttGesture = useCallback(() => {
    tttGestureRef.current.activePointerId = null;
    tttGestureRef.current.previewIndex = null;
    tttGestureRef.current.startX = 0;
    tttGestureRef.current.startY = 0;
    tttGestureRef.current.isDragging = false;
  }, []);

  const handleTttPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (tttGestureRef.current.activePointerId !== event.pointerId) return;
    const commitIndex = tttGestureRef.current.previewIndex;

    if (tttBoardRef.current && typeof tttBoardRef.current.releasePointerCapture === "function") {
      try {
        if (tttBoardRef.current.hasPointerCapture(event.pointerId)) {
          tttBoardRef.current.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release failures.
      }
    }

    clearTttGesture();

    if (commitIndex !== null) {
      commitTttMove(commitIndex);
      tttGestureRef.current.suppressClickUntil = Date.now() + TTT_CLICK_SUPPRESS_MS;
    }

    if (event.pointerType !== "mouse" && event.cancelable) {
      event.preventDefault();
    }
  }, [clearTttGesture, commitTttMove]);

  const handleTttPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (tttGestureRef.current.activePointerId !== event.pointerId) return;

    if (tttBoardRef.current && typeof tttBoardRef.current.releasePointerCapture === "function") {
      try {
        if (tttBoardRef.current.hasPointerCapture(event.pointerId)) {
          tttBoardRef.current.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release failures.
      }
    }

    clearTttGesture();
  }, [clearTttGesture]);

  const handleTttClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() < tttGestureRef.current.suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const index = getTttIndexFromTarget(event.target);
    if (index === null) return;
    commitTttMove(index);
  }, [commitTttMove, getTttIndexFromTarget]);

  const dotsGeometry = useMemo(() => {
    if (!dotsState) return null;
    return getDotsGeometry(dotsState);
  }, [dotsState]);

  const dotsHotBoxIndices = useMemo(() => {
    if (!dotsState || !dotsGeometry) return [];
    return getDotsHotBoxIndices(dotsState, dotsGeometry);
  }, [dotsGeometry, dotsState]);

  const dotsScoringEdges = useMemo(() => {
    if (!dotsState || !dotsGeometry) return new Set<number>();
    return getDotsScoringEdgeIndices(dotsState, dotsGeometry, dotsHotBoxIndices);
  }, [dotsGeometry, dotsHotBoxIndices, dotsState]);

  const dotsLastEdgeIndex = useMemo(() => {
    if (!dotsState) return null;
    return getLastDotsMoveEdgeIndex(dotsState);
  }, [dotsState]);

  const isDotsEdgePlayable = useCallback((edgeIndex: number) => {
    if (!dotsState) return false;
    if (activeGameWinnerId || activeGameDraw) return false;

    const edges = Array.isArray(dotsState.edges) ? dotsState.edges : [];
    if (edgeIndex < 0 || edgeIndex >= edges.length) return false;
    if (edges[edgeIndex] !== null && edges[edgeIndex] !== undefined) return false;

    const nextPlayerId = typeof dotsState.nextPlayerId === "string" ? dotsState.nextPlayerId : null;
    return canActOnTurn(nextPlayerId);
  }, [activeGameDraw, activeGameWinnerId, canActOnTurn, dotsState]);

  const commitDotsMove = useCallback((edgeIndex: number) => {
    if (!Number.isInteger(edgeIndex)) return;
    if (!isDotsEdgePlayable(edgeIndex)) return;
    sendMove({ edgeIndex });
  }, [isDotsEdgePlayable, sendMove]);

  const wordFightContext = useMemo(() => {
    if (!wordFightState || !activeRoom) {
      return {
        canType: false,
        localBlocked: false,
        isFinished: false,
        showPassTurn: false,
        viewerPlayerId: null,
        activeBoardPlayerId: null,
        revealExhaustedWord: false,
        exhaustedWord: ""
      };
    }

    const localBlocked = isLocalMode && localPrivacy.stage === "handoff";
    const isFinished = Boolean(wordFightState.winnerId || wordFightState.draw);
    const viewerPlayerId = isLocalMode ? localViewerId : activeYou.playerId;
    const progressByPlayer = asRecord(wordFightState.progressByPlayer);
    const myProgress = viewerPlayerId ? asRecord(progressByPlayer[viewerPlayerId]) : {};
    const exhausted = Boolean(myProgress.exhausted);
    const solved = Boolean(myProgress.solved);
    const isParticipant = isLocalMode || activeYou.role === "host" || activeYou.role === "guest";
    const nextPlayerId = typeof wordFightState.nextPlayerId === "string" ? wordFightState.nextPlayerId : null;
    const canType = Boolean(!isFinished && !localBlocked && isParticipant && nextPlayerId === viewerPlayerId && !exhausted && !solved);
    const showPassTurn = Boolean(isLocalMode && localBlocked && !isFinished);

    const wordsByPlayer = asRecord(wordFightState.mySecretWord ? { [viewerPlayerId || ""]: wordFightState.mySecretWord } : wordFightState.wordsByPlayer);
    const exhaustedWord = String(wordsByPlayer[viewerPlayerId || ""] || wordFightState.mySecretWord || "").toUpperCase();
    const revealExhaustedWord = Boolean(exhausted && !solved && /^[A-Z]{4}$/.test(exhaustedWord));

    const activeBoardPlayerId = showPassTurn
      ? (viewerPlayerId || nextPlayerId)
      : (nextPlayerId || viewerPlayerId);

    return {
      canType,
      localBlocked,
      isFinished,
      showPassTurn,
      viewerPlayerId,
      activeBoardPlayerId,
      revealExhaustedWord,
      exhaustedWord
    };
  }, [activeRoom, activeYou.playerId, activeYou.role, isLocalMode, localPrivacy.stage, localViewerId, wordFightState]);

  const wordFightActiveEntries = useMemo(() => {
    if (!wordFightState) return [] as Array<Record<string, unknown>>;
    const boardsByPlayer = asRecord(wordFightState.boardsByPlayer);
    const entries = boardsByPlayer[wordFightContext.activeBoardPlayerId || ""];
    return Array.isArray(entries) ? entries.map((entry) => asRecord(entry)) : [];
  }, [wordFightContext.activeBoardPlayerId, wordFightState]);

  const wordFightKeyboardState = useMemo(
    () => resolveWordFightKeyboardState(wordFightActiveEntries),
    [wordFightActiveEntries]
  );

  const wordFightTimerMs = useMemo(() => {
    if (!wordFightState) return 0;
    return getWordFightTurnMsRemaining(wordFightState, clockTick);
  }, [clockTick, wordFightState]);

  const wordFightHint = useMemo(() => {
    if (!wordFightState) return "--";
    const activeHint = String(wordFightState.activeHintCategory || "").trim();
    if (activeHint) return activeHint;

    const nextPlayerId = typeof wordFightState.nextPlayerId === "string" ? wordFightState.nextPlayerId : null;
    const categoryByPlayer = asRecord(wordFightState.categoryByPlayer);
    const fallback = String(categoryByPlayer[nextPlayerId || ""] || "").trim();
    return fallback || "--";
  }, [wordFightState]);

  const handleWordFightKey = useCallback((key: string) => {
    if (!wordFightState || !wordFightContext.canType) return;

    const upper = String(key || "").toUpperCase();

    if (upper === "ENTER") {
      if (wordFightDraft.length !== 4) return;
      sendMove({ guess: wordFightDraft });
      setWordFightDraft("");
      return;
    }

    if (upper === "BACKSPACE") {
      setWordFightDraft((previous) => previous.slice(0, -1));
      return;
    }

    if (!/^[A-Z]$/.test(upper)) return;

    setWordFightDraft((previous) => {
      if (previous.length >= 4) return previous;
      return `${previous}${upper}`;
    });
  }, [sendMove, wordFightContext.canType, wordFightDraft, wordFightState]);

  useEffect(() => {
    if (!wordFightContext.canType || wordFightContext.showPassTurn) {
      setWordFightDraft("");
    }
  }, [wordFightContext.canType, wordFightContext.showPassTurn]);

  const handleWordFightPassTurn = useCallback(() => {
    if (!isLocalMode || !localRoom) return;
    if (localPrivacy.stage !== "handoff") return;
    const nextPrivacy = confirmLocalHandoff(localPrivacy);
    setWordFightDraft("");
    updateLocalRoomState(localRoom, nextPrivacy, []);
    goTo("game", { replace: true });
  }, [goTo, isLocalMode, localPrivacy, localRoom, updateLocalRoomState]);

  const pokerViewerPlayerId = useMemo(() => {
    if (!pokerState) return null;
    return isLocalMode ? localViewerId : activeYou.playerId;
  }, [activeYou.playerId, isLocalMode, localViewerId, pokerState]);

  const pokerContext = useMemo(() => {
    if (!pokerState) {
      return {
        canInteract: false,
        isFinished: false,
        localBlocked: false,
        rollsUsed: 0,
        currentHandNumber: 1,
        diceCount: POKER_DICE_HAND_SIZE,
        dice: [] as Array<number | null>,
        locks: [] as boolean[],
        myFinal: null as Record<string, unknown> | null,
        nextPlayerId: null as string | null,
        openingRollPending: false,
        showPassPlay: false,
        showInitialRollOnly: false,
        isPreRollForViewer: false,
        isMyTurn: false,
        projectedCategory: null as string | null
      };
    }

    const localBlocked = Boolean(isLocalMode && localPrivacy.stage === "handoff");
    const isFinished = Boolean(pokerState.winnerId || pokerState.draw || pokerState.phase === "finished");
    const currentHand = asRecord(pokerState.currentHand);
    const rollsUsedByPlayer = asRecord(currentHand.rollsUsedByPlayer);
    const diceByPlayer = asRecord(currentHand.diceByPlayer);
    const locksByPlayer = asRecord(currentHand.locksByPlayer);
    const finalByPlayer = asRecord(currentHand.finalByPlayer);

    const viewerKey = pokerViewerPlayerId || "";
    const rollsUsed = asNumber(rollsUsedByPlayer[viewerKey], 0);
    const nextPlayerId = typeof pokerState.nextPlayerId === "string" ? pokerState.nextPlayerId : null;
    const diceRaw = Array.isArray(diceByPlayer[viewerKey]) ? diceByPlayer[viewerKey] : [];
    const locksRaw = Array.isArray(locksByPlayer[viewerKey]) ? locksByPlayer[viewerKey] : [];
    const diceCount = Math.max(
      1,
      Number.isInteger(diceRaw.length) && diceRaw.length > 0 ? diceRaw.length : POKER_DICE_HAND_SIZE
    );
    const dice = diceRaw.map((value) => {
      const numeric = asNumber(value, Number.NaN);
      return Number.isInteger(numeric) ? numeric : null;
    });
    const locks = locksRaw.map((value) => Boolean(value));
    const myFinalRaw = viewerKey ? finalByPlayer[viewerKey] : null;
    const myFinal = myFinalRaw && typeof myFinalRaw === "object" ? asRecord(myFinalRaw) : null;

    const isParticipant = isLocalMode || activeYou.role === "host" || activeYou.role === "guest";
    const isMyTurn = Boolean(nextPlayerId && nextPlayerId === pokerViewerPlayerId);
    const canInteract = Boolean(isParticipant && !localBlocked && !isFinished && isMyTurn);
    const nextPlayerRollsUsed = nextPlayerId ? asNumber(rollsUsedByPlayer[nextPlayerId], 0) : 0;
    const openingRollPending = Boolean(!isFinished && nextPlayerId && nextPlayerRollsUsed < 1);

    const hasRolledOnce = rollsUsed >= 1;
    const showPassPlay = Boolean(isLocalMode && !isFinished && !localBlocked && (rollsUsed >= 3 || myFinal));
    const showInitialRollOnly = Boolean(!myFinal && !showPassPlay && !hasRolledOnce);
    const isPreRollForViewer = Boolean(pokerViewerPlayerId && !myFinal && rollsUsed === 0);
    const currentHandNumber = Math.max(1, asNumber(pokerState.currentHandNumber, 1));

    const projected = (myFinal && typeof myFinal.category === "string")
      ? { category: myFinal.category }
      : classifyPokerProjection(dice);

    return {
      canInteract,
      isFinished,
      localBlocked,
      rollsUsed,
      currentHandNumber,
      diceCount,
      dice,
      locks,
      myFinal,
      nextPlayerId,
      openingRollPending,
      showPassPlay,
      showInitialRollOnly,
      isPreRollForViewer,
      isMyTurn,
      projectedCategory: projected?.category || null
    };
  }, [
    activeYou.role,
    isLocalMode,
    localPrivacy.stage,
    pokerPassTargetPlayerId,
    pokerState,
    pokerViewerPlayerId
  ]);

  const clearPokerFxIntervals = useCallback(() => {
    const fx = pokerFxRef.current;
    fx.intervalByIndex.forEach((timerId) => {
      window.clearInterval(timerId);
    });
    fx.intervalByIndex.clear();
  }, []);

  const clearPokerFxTimers = useCallback(() => {
    const fx = pokerFxRef.current;
    if (fx.stopTimeoutId !== null) {
      window.clearTimeout(fx.stopTimeoutId);
      fx.stopTimeoutId = null;
    }
    if (fx.settleTimeoutId !== null) {
      window.clearTimeout(fx.settleTimeoutId);
      fx.settleTimeoutId = null;
    }
  }, []);

  const resetPokerFxState = useCallback(() => {
    clearPokerFxIntervals();
    clearPokerFxTimers();
    pokerFxRef.current = createInitialPokerFxInternalState();
    setPokerFxUi(createInitialPokerFxUiState());
  }, [clearPokerFxIntervals, clearPokerFxTimers]);

  const finalizePokerDiceRollFx = useCallback(() => {
    const fx = pokerFxRef.current;
    if (!fx.waitingForResolution && fx.rollingIndices.size === 0) return;

    clearPokerFxIntervals();
    if (fx.stopTimeoutId !== null) {
      window.clearTimeout(fx.stopTimeoutId);
      fx.stopTimeoutId = null;
    }

    const settlingIndices = [...fx.rollingIndices];
    const settleUntil = Date.now() + POKER_DICE_SETTLE_MS;
    settlingIndices.forEach((index) => {
      fx.settleUntilByIndex.set(index, settleUntil);
    });

    fx.rollingIndices.clear();
    fx.waitingForResolution = false;
    fx.expectedRollsUsed = null;
    fx.baselineDiceKey = "";
    fx.activeRollToken = 0;
    fx.minEndAt = 0;

    setPokerFxUi((previousState) => ({
      ...previousState,
      waitingForResolution: false,
      rollingIndices: [],
      settlingIndices,
      displayFacesByDie: {}
    }));

    if (fx.settleTimeoutId !== null) {
      window.clearTimeout(fx.settleTimeoutId);
    }
    fx.settleTimeoutId = window.setTimeout(() => {
      const currentFx = pokerFxRef.current;
      currentFx.settleUntilByIndex.clear();
      currentFx.settleTimeoutId = null;
      setPokerFxUi((previousState) => ({
        ...previousState,
        settlingIndices: [],
        rollStyleByDie: {}
      }));
    }, POKER_DICE_SETTLE_MS);
  }, [clearPokerFxIntervals]);

  const maybeFinalizePokerDiceRollFx = useCallback(() => {
    const fx = pokerFxRef.current;
    if (!fx.waitingForResolution) return;

    const viewerPlayerId = pokerViewerPlayerRef.current;
    if (fx.viewerPlayerId && viewerPlayerId && fx.viewerPlayerId !== viewerPlayerId) {
      resetPokerFxState();
      return;
    }

    const currentDice = pokerServerDiceRef.current;
    const currentRollsUsed = pokerServerRollsUsedRef.current;

    const hasResolved = (
      Number.isInteger(fx.expectedRollsUsed) && currentRollsUsed >= Number(fx.expectedRollsUsed)
    ) || getPokerDiceValuesKey(currentDice) !== fx.baselineDiceKey;

    if (!hasResolved) return;
    if (Date.now() < fx.minEndAt) return;
    finalizePokerDiceRollFx();
  }, [finalizePokerDiceRollFx, resetPokerFxState]);

  const startPokerDiceRollFx = useCallback((options: {
    diceCount: number;
    holdIndices: number[];
    baselineDice: Array<number | null>;
    baselineRollsUsed: number;
    viewerPlayerId: string | null;
  }) => {
    const { diceCount, holdIndices, baselineDice, baselineRollsUsed, viewerPlayerId } = options;
    if (!Number.isInteger(diceCount) || diceCount < 1) return;

    const holds = new Set(
      Array.isArray(holdIndices)
        ? holdIndices.filter((value) => Number.isInteger(value) && value >= 0 && value < diceCount)
        : []
    );

    resetPokerFxState();
    const fx = pokerFxRef.current;
    fx.pendingRollToken += 1;
    fx.activeRollToken = fx.pendingRollToken;
    fx.waitingForResolution = true;
    fx.minEndAt = Date.now() + POKER_DICE_ROLL_DURATION_MS;
    fx.expectedRollsUsed = Number.isInteger(baselineRollsUsed) ? baselineRollsUsed + 1 : null;
    fx.viewerPlayerId = viewerPlayerId || null;
    fx.baselineDiceKey = getPokerDiceValuesKey(baselineDice);
    const rollToken = fx.activeRollToken;

    const rollingIndices: number[] = [];
    const nextRollStyleByDie: Record<number, CSSProperties> = {};
    const nextDisplayFacesByDie: Record<number, number> = {};

    for (let index = 0; index < diceCount; index += 1) {
      if (holds.has(index)) continue;
      fx.rollingIndices.add(index);
      rollingIndices.push(index);
      const rollProfile = {
        shuffleOffset: randomBetween(0, POKER_DICE_FACE_VALUES.length - 1),
        speedMs: randomBetween(POKER_DICE_ROLL_SPEED_MIN_MS, POKER_DICE_ROLL_SPEED_MAX_MS),
        startDelayMs: randomBetween(0, POKER_DICE_ROLL_DELAY_MAX_MS)
      };

      fx.rollProfileByIndex.set(index, rollProfile);
      fx.shuffleCursorByIndex.set(index, rollProfile.shuffleOffset);
      const initialFace = POKER_DICE_FACE_VALUES[rollProfile.shuffleOffset] || POKER_DICE_FACE_VALUES[0];
      fx.lastShownFaceByIndex.set(index, initialFace);
      nextDisplayFacesByDie[index] = initialFace;
      nextRollStyleByDie[index] = buildPokerRollStyle(rollProfile.startDelayMs, rollProfile.speedMs);

      const tickMs = randomBetween(POKER_DICE_SHUFFLE_MIN_MS, POKER_DICE_SHUFFLE_MAX_MS);
      const intervalId = window.setInterval(() => {
        const currentFx = pokerFxRef.current;
        if (currentFx.activeRollToken !== rollToken || !currentFx.rollingIndices.has(index)) return;

        const currentCursor = Number(currentFx.shuffleCursorByIndex.get(index) || 0);
        const step = randomBetween(1, 2);
        let nextCursor = (currentCursor + step) % POKER_DICE_FACE_VALUES.length;
        let nextFace = POKER_DICE_FACE_VALUES[nextCursor];
        let retry = 0;
        while (retry < 2) {
          const matchingFaceCount = [...currentFx.rollingIndices].reduce((count, dieIndex) => {
            if (dieIndex === index) return count;
            return count + (Number(currentFx.lastShownFaceByIndex.get(dieIndex)) === nextFace ? 1 : 0);
          }, 0);
          if (matchingFaceCount < 2) break;
          nextCursor = (nextCursor + 1) % POKER_DICE_FACE_VALUES.length;
          nextFace = POKER_DICE_FACE_VALUES[nextCursor];
          retry += 1;
        }

        currentFx.shuffleCursorByIndex.set(index, nextCursor);
        currentFx.lastShownFaceByIndex.set(index, nextFace);
        setPokerFxUi((previousState) => ({
          ...previousState,
          displayFacesByDie: {
            ...previousState.displayFacesByDie,
            [index]: nextFace
          }
        }));
      }, tickMs);
      fx.intervalByIndex.set(index, intervalId);
    }

    setPokerFxUi({
      rollingIndices,
      settlingIndices: [],
      rollStyleByDie: nextRollStyleByDie,
      displayFacesByDie: nextDisplayFacesByDie,
      waitingForResolution: true
    });

    fx.stopTimeoutId = window.setTimeout(() => {
      const currentFx = pokerFxRef.current;
      if (currentFx.activeRollToken !== rollToken) return;
      maybeFinalizePokerDiceRollFx();
    }, POKER_DICE_ROLL_DURATION_MS);
  }, [maybeFinalizePokerDiceRollFx, resetPokerFxState]);

  useEffect(() => {
    pokerServerDiceRef.current = pokerContext.dice;
    pokerServerRollsUsedRef.current = pokerContext.rollsUsed;
    pokerViewerPlayerRef.current = pokerViewerPlayerId;
  }, [pokerContext.dice, pokerContext.rollsUsed, pokerViewerPlayerId]);

  useEffect(() => () => {
    resetPokerFxState();
  }, [resetPokerFxState]);

  useEffect(() => {
    if (pokerState) return;
    resetPokerFxState();
    setPokerProjectedGuideCategory(null);
  }, [pokerState, resetPokerFxState]);

  useEffect(() => {
    if (!pokerFxUi.waitingForResolution) return;
    maybeFinalizePokerDiceRollFx();
  }, [
    maybeFinalizePokerDiceRollFx,
    pokerContext.dice,
    pokerContext.rollsUsed,
    pokerFxUi.waitingForResolution,
    pokerViewerPlayerId
  ]);

  useEffect(() => {
    if (!pokerContext.canInteract || !pokerState) {
      setPokerDicePendingHolds([]);
      return;
    }

    if (pokerFxUi.waitingForResolution) {
      setPokerDicePendingHolds([]);
      return;
    }

    if (pokerDicePendingHolds.length > 0) return;
    if (pokerContext.rollsUsed < 1) return;

    const nextHolds = pokerContext.locks
      .map((locked, index) => (locked ? index : null))
      .filter((entry): entry is number => Number.isInteger(entry));

    setPokerDicePendingHolds(nextHolds);
  }, [
    pokerContext.canInteract,
    pokerContext.locks,
    pokerContext.rollsUsed,
    pokerFxUi.waitingForResolution,
    pokerDicePendingHolds.length,
    pokerState
  ]);

  const commitPokerRoll = useCallback(() => {
    if (!pokerState || pokerFxUi.waitingForResolution) return;
    const hold = [...pokerDicePendingHolds]
      .map((entry) => asNumber(entry, Number.NaN))
      .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < POKER_DICE_HAND_SIZE);
    const diceCount = Math.max(1, pokerContext.diceCount || POKER_DICE_HAND_SIZE);
    startPokerDiceRollFx({
      diceCount,
      holdIndices: hold,
      baselineDice: pokerContext.dice,
      baselineRollsUsed: pokerContext.rollsUsed,
      viewerPlayerId: pokerViewerPlayerId
    });
    setPokerDicePendingHolds([]);
    const didSend = sendMove({ action: "roll", hold });
    if (!didSend) {
      resetPokerFxState();
      setPokerDicePendingHolds(hold);
    }
  }, [
    pokerContext.dice,
    pokerContext.diceCount,
    pokerContext.rollsUsed,
    pokerDicePendingHolds,
    pokerFxUi.waitingForResolution,
    pokerState,
    pokerViewerPlayerId,
    resetPokerFxState,
    sendMove,
    startPokerDiceRollFx
  ]);

  const commitPokerBank = useCallback(() => {
    if (!pokerState || pokerFxUi.waitingForResolution) return;
    resetPokerFxState();
    setPokerDicePendingHolds([]);
    sendMove({ action: "bank" });
  }, [pokerFxUi.waitingForResolution, pokerState, resetPokerFxState, sendMove]);

  const handlePokerPassPlay = useCallback(() => {
    if (!isLocalMode || !localRoom || !pokerState) return;
    const targetPlayerId = pokerPassTargetPlayerId || pokerContext.nextPlayerId;
    if (!targetPlayerId) return;
    resetPokerFxState();

    const nextPrivacy: LocalPrivacyState = {
      ...localPrivacy,
      viewerPlayerId: targetPlayerId,
      pendingViewerPlayerId: null,
      stage: "visible",
      prompt: ""
    };

    setPokerPassTargetPlayerId(null);
    updateLocalRoomState(localRoom, nextPrivacy, []);
    goTo("game", { replace: true });
  }, [
    goTo,
    isLocalMode,
    localPrivacy,
    localRoom,
    pokerContext.nextPlayerId,
    pokerPassTargetPlayerId,
    pokerState,
    resetPokerFxState,
    updateLocalRoomState
  ]);

  const pokerIsFxRolling = pokerFxUi.waitingForResolution && pokerFxUi.rollingIndices.length > 0;
  const pokerPreRollCoach = useMemo(() => {
    if (!pokerState || !pokerContext.isPreRollForViewer || !pokerContext.openingRollPending) {
      return {
        mode: "hidden" as const,
        message: ""
      };
    }

    if (pokerContext.canInteract) {
      return {
        mode: "ready_to_roll" as const,
        message: POKER_DICE_PREROLL_READY_COPY
      };
    }

    const openingPlayer = playerById(activeRoom, pokerContext.nextPlayerId);
    const openerName = getDisplayPlayerName(openingPlayer, "the other player");
    return {
      mode: "waiting_for_opening_roll" as const,
      message: `Waiting for ${openerName} to open this hand.`
    };
  }, [
    activeRoom,
    pokerContext.canInteract,
    pokerContext.isPreRollForViewer,
    pokerContext.nextPlayerId,
    pokerContext.openingRollPending,
    pokerState
  ]);

  const pokerRenderedDice = useMemo(() => {
    if (!pokerState) return [] as Array<number | null>;
    const diceCount = Math.max(1, pokerContext.diceCount || POKER_DICE_HAND_SIZE);
    const baseDice = (() => {
      if (pokerContext.isPreRollForViewer) {
        return Array.from({ length: diceCount }, () => null);
      }

      if (pokerContext.rollsUsed >= 1) {
        return Array.from({ length: diceCount }, (_, index) => {
          const value = pokerContext.dice[index];
          return Number.isInteger(value) ? Number(value) : null;
        });
      }

      return Array.from({ length: diceCount }, () => null);
    })();

    if (!pokerFxUi.waitingForResolution) {
      return baseDice;
    }

    return baseDice.map((value, index) => {
      const displayFace = pokerFxUi.displayFacesByDie[index];
      if (Number.isInteger(displayFace)) return Number(displayFace);
      return value;
    });
  }, [
    pokerContext.dice,
    pokerContext.diceCount,
    pokerContext.isPreRollForViewer,
    pokerContext.rollsUsed,
    pokerFxUi.displayFacesByDie,
    pokerFxUi.waitingForResolution,
    pokerState,
    pokerViewerPlayerId
  ]);

  useEffect(() => {
    if (!pokerState) return;
    if (pokerIsFxRolling) return;
    if (pokerContext.isPreRollForViewer || !pokerContext.projectedCategory) {
      setPokerProjectedGuideCategory(null);
      return;
    }
    setPokerProjectedGuideCategory(pokerContext.projectedCategory);
  }, [
    pokerContext.isPreRollForViewer,
    pokerContext.projectedCategory,
    pokerIsFxRolling,
    pokerState
  ]);

  const currentGameEnded = Boolean(activeGameWinnerId || activeGameDraw);
  const gameFinished = Boolean(activeRoom?.game && currentGameEnded);

  const showEndGameButton = Boolean(
    !isLocalMode
    && activeRoom?.game
    && !currentGameEnded
    && (activeYou.role === "host" || activeYou.role === "guest")
  );

  const hasPendingEndRequest = Boolean(activeRoom && asRecord(activeRoom.endRequest).byId);
  const endRequesterId = hasPendingEndRequest
    ? String(asRecord(activeRoom?.endRequest).byId || "")
    : "";

  const isEndRequester = Boolean(endRequesterId && endRequesterId === activeYou.playerId);
  const endButtonLabel = hasPendingEndRequest && !isEndRequester
    ? "Agree end game"
    : (isEndRequester ? "Waiting..." : "End game");

  const newRoundButtonLabel = "Pick next game";
  const showNewRoundButton = Boolean(gameFinished && (isLocalMode || activeYou.role === "host" || activeYou.role === "guest"));

  const waitPlayer = useMemo(() => {
    if (!activeRoom) return null;
    const pickerId = activeRoom.round?.firstPlayerId || activeRoom.round?.pickerId || null;
    return playerById(activeRoom, pickerId);
  }, [activeRoom]);

  const lobbyStatusMessage = useMemo(() => {
    if (!activeRoom) return "";

    const gameActive = Boolean(activeRoom.game && !currentGameEnded);
    const isPlayer = isLocalMode || activeYou.role === "host" || activeYou.role === "guest";

    if (isLocalMode) return "";
    if (gameActive) return "Finish current game before picking another.";
    if (!activeRoom.players.host || !activeRoom.players.guest) return "Waiting for both players to join.";

    const myChoiceId = activeYou.role === "host" ? onlineHostChoiceId : onlineGuestChoiceId;
    const otherChoiceId = activeYou.role === "host" ? onlineGuestChoiceId : onlineHostChoiceId;
    const picksMatch = Boolean(onlineHostChoiceId && onlineGuestChoiceId && onlineHostChoiceId === onlineGuestChoiceId);
    const picksMismatch = Boolean(onlineHostChoiceId && onlineGuestChoiceId && onlineHostChoiceId !== onlineGuestChoiceId);

    if (onlineCountdownActive && resolvedChoiceId) {
      return `Both agreed on ${getGameName(activeRoom, resolvedChoiceId)}. Starting in ${onlineCountdownSeconds}...`;
    }
    if (myChoiceId && !otherChoiceId) {
      return `You chose ${getGameName(activeRoom, myChoiceId)}. Waiting for teammate to agree.`;
    }
    if (!myChoiceId && otherChoiceId) {
      return `Teammate picked ${getGameName(activeRoom, otherChoiceId)}. Tap Agree to start.`;
    }
    if (picksMismatch) {
      return "Different picks. Choose the same game to start.";
    }
    if (picksMatch && myChoiceId) {
      return `Matched on ${getGameName(activeRoom, myChoiceId)}.`;
    }
    if (isPlayer) {
      return "Choose a game to start.";
    }
    return "Waiting for players to choose.";
  }, [
    activeRoom,
    activeYou.role,
    currentGameEnded,
    isLocalMode,
    onlineCountdownActive,
    onlineCountdownSeconds,
    onlineGuestChoiceId,
    onlineHostChoiceId,
    resolvedChoiceId
  ]);

  const closeSetupSheetFor = useCallback((screen: ScreenKey) => {
    closeSetupSheet(screen);
  }, [closeSetupSheet]);

  return (
    <>
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
              onClick={isReactRuntime ? () => {
                setMode("local");
                goTo("local");
              } : undefined}
            >
              Local
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
              onClick={isReactRuntime ? () => {
                setMode("online");
                goTo("online");
              } : undefined}
            >
              Online
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
                onClick={handleLocalRejoin}
                disabled={!hasLocalRejoin}
              >
                Resume
              </Button>
              <Button
                id="local-clear-rejoin"
                variant="ghost"
                className="compact-action banner-action"
                onClick={handleClearLocalRejoin}
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
                onClick={handleRejoin}
                disabled={!hasOnlineRejoin}
              >
                Rejoin
              </Button>
              <Button
                id="clear-rejoin"
                variant="ghost"
                className="compact-action banner-action"
                onClick={handleClearRejoin}
                disabled={!hasOnlineRejoin}
              >
                Leave
              </Button>
            </div>
          </div>
        </div>
      </Screen>

      <SheetScreen
        id="screen-local"
        panelClassName="setup-sheet-panel"
        className={closingSetupScreen === "local" ? "is-closing" : ""}
        active={activeScreen === "local" || closingSetupScreen === "local"}
        onClose={() => closeSetupSheetFor("local")}
      >
        <Card className="setup-card">
          <CardHeader className="setup-card-header setup-card-header-local">
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
                onChange={(checked) => {
                  setLocalHonorifics((previous) => {
                    if (localStep === "p1") {
                      return { ...previous, p1: checked ? "mrs" : "mr" };
                    }
                    return { ...previous, p2: checked ? "mrs" : "mr" };
                  });
                }}
              />
            </div>
            <div className="local-choices">
              <div>
                <LocalAvatarGrid
                  selectedAvatarId={currentLocalAvatarId}
                  localStep={localStep}
                  localAvatars={localAvatars}
                  localHonorifics={localHonorifics}
                  onSelect={(avatarId) => {
                    if (localStep === "p1") {
                      setLocalAvatars((previous) => ({ ...previous, one: avatarId }));
                      return;
                    }
                    if (localAvatars.one === avatarId) return;
                    setLocalAvatars((previous) => ({ ...previous, two: avatarId }));
                  }}
                />
              </div>
              <div className="button-row local-setup-cta-row">
                <Button id="local-continue" className="cta-main" disabled={localCtaDisabled} onClick={handleLocalContinue}>
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
          <CardHeader className="setup-card-header setup-card-header-online">
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
              onClick={isReactRuntime ? () => {
                setMode("online");
                goTo("host");
              } : undefined}
            >
              Host a room
            </Button>
            <Button
              id="go-join"
              variant="ghost"
              onClick={isReactRuntime ? () => {
                setMode("online");
                goTo("join");
              } : undefined}
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
          <CardHeader className="setup-card-header setup-card-header-online">
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
                onChange={(checked) => setHostHonorific(checked ? "mrs" : "mr")}
              />
            </div>
            <AvatarPickerGrid id="host-avatar-picker" selectedId={hostAvatar} onSelect={setHostAvatar} />
            <div className="button-row host-setup-cta-row">
              <Button
                id="create-room"
                className="cta-main"
                disabled={!hostAvatar}
                onClick={isReactRuntime ? () => {
                  if (!hostAvatar) return;
                  setMode("online");
                  createRoom(hostAvatar, hostHonorific);
                } : undefined}
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
          <CardHeader className="setup-card-header setup-card-header-online">
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
            validating={state.join.status === "validating"}
            step={joinStep}
            selectedAvatarId={joinAvatar}
            disabledAvatarIds={joinDisabledAvatarIds}
            honorific={joinHonorific}
            lockedAvatarId={joinHostAvatarId}
            lockedAvatarLabel={joinLockedAvatarLabel}
            lockedAvatarArtSrc={joinLockedAvatarArtSrc}
            onCodeChange={handleJoinCodeChange}
            onCodeComplete={handleJoinCodeComplete}
            onAvatarSelect={setJoinAvatar}
            onHonorificChange={setJoinHonorific}
          />
          <div className="button-row join-setup-cta-row">
            <Button id="join-room" className="cta-main" disabled={joinCtaDisabled} onClick={handleJoinPrimaryAction}>
              {joinCtaLabel}
            </Button>
          </div>
        </Card>
      </SheetScreen>

      <Screen id="screen-lobby" active={activeScreen === "lobby"}>
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
            <p id="pick-status" className={`pick-status${lobbyStatusMessage ? "" : " hidden"}`} aria-live="polite">
              {lobbyStatusMessage}
            </p>

            <div id="game-list" className="game-grid">
              {lobbyGames.map((game) => {
                const gameId = String(game.id || "");
                const comingSoon = Boolean(game.comingSoon);
                const gameActive = Boolean(activeRoom?.game && !currentGameEnded);
                const isCurrentActiveGame = Boolean(gameActive && activeRoom?.game?.id === gameId);
                const isPlayer = isLocalMode || activeYou.role === "host" || activeYou.role === "guest";
                const canPick = Boolean(isPlayer && activeRoom?.players.host && activeRoom?.players.guest && !gameActive);

                const myChoiceId = !isLocalMode
                  ? (activeYou.role === "host" ? onlineHostChoiceId : onlineGuestChoiceId)
                  : resolvedChoiceId;
                const otherChoiceId = !isLocalMode
                  ? (activeYou.role === "host" ? onlineGuestChoiceId : onlineHostChoiceId)
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
                          onClick={() => handleSelectLobbyGame(gameId)}
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

      <Screen id="screen-pick" active={activeScreen === "pick"}>
        <div className="screen-head pick-head pick-legacy-note">
          <div>
            <h2>Pick a game</h2>
          </div>
        </div>
      </Screen>

      <Screen id="screen-wait" active={activeScreen === "wait"}>
        <div className="panel wait-panel">
          <h2>Waiting for a game</h2>
          <div className="wait-card">
            <div>
              <div id="wait-name" className="wait-name">{getDisplayPlayerName(waitPlayer, "Waiting")}</div>
              <p id="wait-text" className="subtext">starts this round.</p>
            </div>
          </div>
          <PlayerStatusStrip
            leftName={getDisplayPlayerName(activeRoom?.players.host, "Host")}
            leftState={activeRoom?.players.host?.connected === false ? "Disconnected" : "Connected"}
            rightName={activeRoom?.players.guest ? getDisplayPlayerName(activeRoom.players.guest, "Guest") : "Guest"}
            rightState={activeRoom?.players.guest
              ? (activeRoom.players.guest.connected === false ? "Disconnected" : "Connected")
              : "Waiting"}
            compact
          />
        </div>
      </Screen>

      <Screen id="screen-game" active={activeScreen === "game"}>
        <div className="game-screen-layout">
          <div className="game-turn-footer">
            <TurnStatusBar
              room={activeRoom}
              displayState={activeDisplayState}
              mode={turnBarMode}
              activePlayerId={turnBarActivePlayerId}
            />
          </div>

          <GameSurfaceShell
            showHead={false}
            state={activeRoom?.game ? "active" : "idle"}
            actions={(
              <GameActionRow>
                <Button
                  id="game-close-board"
                  variant="ghost"
                  className={`compact-action${activeRoom?.game ? "" : " hidden"}`}
                  onClick={handleCloseBoard}
                >
                  Close
                </Button>

                <Button
                  id="end-game-game"
                  variant="ghost"
                  className={showEndGameButton ? "" : "hidden"}
                  onClick={handleEndGame}
                  disabled={isEndRequester}
                >
                  {endButtonLabel}
                </Button>

                <Button
                  id="new-round"
                  variant="ghost"
                  className={showNewRoundButton ? "" : "hidden"}
                  onClick={handleNewRound}
                >
                  {newRoundButtonLabel}
                </Button>
              </GameActionRow>
            )}
          >
            <div
              id="ttt-board"
              ref={tttBoardRef}
              className={`ttt-board${tttState ? "" : " hidden"}${tttState ? " game-board-highlight" : ""}${tttState && activeGameWinnerId ? " has-winning-line is-finished" : ""}${tttState && activeRoom?.players.host?.theme ? ` theme-${activeRoom.players.host.theme}` : ""}`}
              onPointerDown={handleTttPointerDown}
              onPointerMove={handleTttPointerMove}
              onPointerUp={handleTttPointerUp}
              onPointerCancel={handleTttPointerCancel}
              onClick={handleTttClick}
            >
              {tttState
                ? (Array.isArray(tttState.board) ? tttState.board : []).map((cell, index) => {
                  const symbols = asRecord(tttState.symbols);
                  const ownerEntry = Object.entries(symbols).find(([, symbol]) => symbol === cell);
                  const ownerPlayerId = ownerEntry?.[0] || null;
                  const owner = playerById(activeRoom, ownerPlayerId);
                  const winningLine = Array.isArray(tttState.winningLine)
                    ? tttState.winningLine.map((entry) => asNumber(entry, Number.NaN)).filter((entry) => Number.isInteger(entry))
                    : [];
                  const isWinning = winningLine.includes(index);
                  const isReason = Boolean(winReveal && winReveal.boardId === "ttt" && winReveal.indices.includes(index));
                  const isPreview = tttGestureRef.current.previewIndex === index;

                  return (
                    <button
                      key={`ttt-${index}`}
                      type="button"
                      className={`ttt-cell${isWinning ? " is-winning" : ""}${isReason ? " is-win-reason" : ""}${isPreview ? " is-preview" : ""}`}
                      data-index={index}
                      disabled={!isTicTacToeCellPlayable(index)}
                    >
                      {cell ? (
                        <span className={`ttt-mark ${cell === "X" ? "ttt-mark-x" : "ttt-mark-o"}${owner?.theme ? ` theme-${owner.theme}` : ""}`}>
                          {cell === "X" ? <><span></span><span></span></> : <span></span>}
                        </span>
                      ) : null}
                    </button>
                  );
                })
                : null}
            </div>

            <div id="dots-layout" className={`dots-layout${dotsState ? "" : " hidden"}`}>
              <div
                id="dots-board"
                className="dots-board"
                style={dotsGeometry ? ({ "--dots-grid-size": String(dotsGeometry.gridSize) } as CSSProperties) : undefined}
              >
                {dotsState && dotsGeometry
                  ? Array.from({ length: dotsGeometry.gridSize * dotsGeometry.gridSize }, (_, flatIndex) => {
                    const row = Math.floor(flatIndex / dotsGeometry.gridSize);
                    const col = flatIndex % dotsGeometry.gridSize;
                    const rowEven = row % 2 === 0;
                    const colEven = col % 2 === 0;

                    if (rowEven && colEven) {
                      return <span key={`dot-${row}-${col}`} className="dots-dot" aria-hidden="true" />;
                    }

                    if (rowEven && !colEven) {
                      const edgeIndex = (row / 2) * dotsGeometry.boxSpan + ((col - 1) / 2);
                      const edges = Array.isArray(dotsState.edges) ? dotsState.edges : [];
                      const ownerId = typeof edges[edgeIndex] === "string" ? String(edges[edgeIndex]) : null;
                      const owner = playerById(activeRoom, ownerId);
                      const playable = isDotsEdgePlayable(edgeIndex);
                      const isScoring = playable && dotsScoringEdges.has(edgeIndex);

                      return (
                        <button
                          key={`edge-h-${edgeIndex}`}
                          type="button"
                          className={`dots-edge dots-edge-h${owner ? " is-claimed" : ""}${playable ? " is-playable" : ""}${isScoring ? " is-scoring-opportunity" : ""}${dotsLastEdgeIndex === edgeIndex ? " is-last-move" : ""}${owner?.theme ? ` theme-${owner.theme}` : ""}`}
                          data-edge-index={edgeIndex}
                          disabled={!playable}
                          onClick={() => commitDotsMove(edgeIndex)}
                        />
                      );
                    }

                    if (!rowEven && colEven) {
                      const edgeIndex = dotsGeometry.horizontalEdgeCount + (((row - 1) / 2) * dotsGeometry.dotCount) + (col / 2);
                      const edges = Array.isArray(dotsState.edges) ? dotsState.edges : [];
                      const ownerId = typeof edges[edgeIndex] === "string" ? String(edges[edgeIndex]) : null;
                      const owner = playerById(activeRoom, ownerId);
                      const playable = isDotsEdgePlayable(edgeIndex);
                      const isScoring = playable && dotsScoringEdges.has(edgeIndex);

                      return (
                        <button
                          key={`edge-v-${edgeIndex}`}
                          type="button"
                          className={`dots-edge dots-edge-v${owner ? " is-claimed" : ""}${playable ? " is-playable" : ""}${isScoring ? " is-scoring-opportunity" : ""}${dotsLastEdgeIndex === edgeIndex ? " is-last-move" : ""}${owner?.theme ? ` theme-${owner.theme}` : ""}`}
                          data-edge-index={edgeIndex}
                          disabled={!playable}
                          onClick={() => commitDotsMove(edgeIndex)}
                        />
                      );
                    }

                    const boxIndex = (((row - 1) / 2) * dotsGeometry.boxSpan) + ((col - 1) / 2);
                    const boxes = Array.isArray(dotsState.boxes) ? dotsState.boxes : [];
                    const ownerId = typeof boxes[boxIndex] === "string" ? String(boxes[boxIndex]) : null;
                    const owner = playerById(activeRoom, ownerId);
                    const isHot = !owner && dotsHotBoxIndices.includes(boxIndex);
                    const isReason = Boolean(winReveal && winReveal.boardId === "dots_boxes" && winReveal.indices.includes(boxIndex));

                    return (
                      <div
                        key={`box-${boxIndex}`}
                        className={`dots-box${owner ? " is-claimed" : ""}${isHot ? " is-hot-box" : ""}${isReason ? " is-win-reason" : ""}${owner?.theme ? ` theme-${owner.theme}` : ""}`}
                        data-box-index={boxIndex}
                      />
                    );
                  })
                  : null}
              </div>
            </div>

            <div id="unsupported-game-layout" className={`unsupported-game-layout${activeGameId && (!getLocalGame(activeGameId) || activeGameId === "battleships") ? "" : " hidden"}`} aria-live="polite">
              <div className="unsupported-game-card">
                <h3 id="unsupported-game-title">{activeRoom?.game?.name || "Game unavailable"}</h3>
                <p id="unsupported-game-message" className="subtext">
                  This game mode is no longer supported in this version.
                </p>
              </div>
            </div>

            <div id="word-fight-layout" className={`word-fight-layout${wordFightState ? "" : " hidden"}`}>
              <div className="word-fight-controls">
                <div id="word-fight-actions" className={`word-fight-actions${wordFightContext.showPassTurn ? "" : " hidden"}`}>
                  <Button
                    id="word-fight-pass-turn"
                    variant="ghost"
                    className={`compact-action${wordFightContext.showPassTurn ? "" : " hidden"}`}
                    onClick={handleWordFightPassTurn}
                    disabled={!wordFightContext.showPassTurn}
                  >
                    Pass turn
                  </Button>
                </div>

                <div id="word-fight-keyboard" className={`word-fight-keyboard${wordFightContext.showPassTurn ? " hidden" : ""}`} aria-label="Word Fight keyboard">
                  {[
                    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
                    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
                    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"]
                  ].map((row, rowIndex) => (
                    <div key={`wf-row-${rowIndex}`} className="word-fight-keyboard-row">
                      {row.map((keyLabel) => {
                        const letterState = wordFightKeyboardState[keyLabel] || null;
                        const isAction = keyLabel === "ENTER" || keyLabel === "BACKSPACE";
                        const buttonLabel = keyLabel === "BACKSPACE" ? "⌫" : keyLabel;
                        return (
                          <button
                            key={`wf-key-${keyLabel}`}
                            type="button"
                            className={`word-fight-key${isAction ? " is-action" : ""}${letterState ? ` is-${letterState}` : ""}`}
                            data-word-fight-key={keyLabel}
                            disabled={!wordFightContext.canType}
                            onClick={() => handleWordFightKey(keyLabel)}
                          >
                            {buttonLabel}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <p id="word-fight-status" className={`subtext word-fight-status${wordFightContext.revealExhaustedWord ? " is-visible" : ""}`}>
                  {wordFightContext.revealExhaustedWord
                    ? `Out of guesses. Your word was ${wordFightContext.exhaustedWord}.`
                    : ""}
                </p>
              </div>

              <section className="word-fight-board-card word-fight-board-card-single">
                <div className="word-fight-board-header">
                  <h3 id="word-fight-active-title">Hint: {wordFightHint}</h3>
                  <span id="word-fight-turn-timer" className={`word-fight-turn-timer${wordFightTimerMs > 0 && wordFightTimerMs <= 10_000 ? " is-expiring" : ""}`} aria-label="Turn timer">
                    {wordFightState ? formatWordFightTurnClock(wordFightTimerMs) : "--:--"}
                  </span>
                </div>
                <div id="word-fight-active-board" className="word-fight-board-grid">
                  {wordFightState
                    ? Array.from({ length: asNumber(wordFightState.maxGuesses, 5) }, (_, rowIndex) => {
                      const entry = wordFightActiveEntries[rowIndex] || null;
                      const draftRowIndex = wordFightContext.canType && !wordFightContext.showPassTurn
                        ? wordFightActiveEntries.length
                        : -1;

                      return (
                        <div key={`wf-board-row-${rowIndex}`} className="word-fight-row">
                          {Array.from({ length: 4 }, (_, colIndex) => {
                            const feedback = entry && Array.isArray(entry.feedback)
                              ? String(entry.feedback[colIndex] || "")
                              : "";
                            const entryGuess = entry ? String(entry.guess || "") : "";
                            const letter = entry
                              ? String(entryGuess[colIndex] || "")
                              : (rowIndex === draftRowIndex ? String(wordFightDraft[colIndex] || "") : "");

                            return (
                              <span
                                key={`wf-board-tile-${rowIndex}-${colIndex}`}
                                className={`word-fight-tile${feedback === "exact" || feedback === "present" || feedback === "absent" ? ` is-${feedback}` : ""}`}
                              >
                                {letter}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })
                    : null}
                </div>
              </section>
            </div>

            <div
              id="poker-dice-layout"
              className={`poker-dice-layout${pokerState ? "" : " hidden"}${pokerContext.isPreRollForViewer ? " is-preroll-viewer" : ""}`}
            >
              <p id="poker-dice-round-title" className="poker-dice-round-title">
                {pokerState
                  ? `Round ${pokerContext.currentHandNumber} of ${Math.max(1, asNumber(pokerState.bestOfHands, 3))}`
                  : "Round 1 of 3"}
              </p>
              {pokerPreRollCoach.mode !== "hidden" ? (
                <p
                  id="poker-dice-preroll-status"
                  className="poker-dice-preroll-status"
                  data-state={pokerPreRollCoach.mode}
                  aria-live="polite"
                >
                  {pokerPreRollCoach.message}
                </p>
              ) : null}

              <div id="poker-dice-dice" className="poker-dice-dice">
                {(pokerState ? pokerRenderedDice : []).map((dieValue, index) => {
                  const isHeld = pokerDicePendingHolds.includes(index);
                  const isRolling = pokerFxUi.rollingIndices.includes(index);
                  const isSettling = pokerFxUi.settlingIndices.includes(index);
                  const canToggleHold = pokerContext.canInteract
                    && pokerContext.rollsUsed >= 1
                    && !pokerContext.myFinal?.category
                    && !pokerFxUi.waitingForResolution;
                  const dieFace = getPokerDieFace(dieValue);

                  return (
                    <button
                      key={`pd-die-${index}`}
                      type="button"
                      className={`poker-die${isHeld ? " is-hold" : ""}${isRolling ? " is-rolling" : ""}${isSettling ? " is-settling" : ""}`}
                      data-die-index={index}
                      aria-label={dieFace ? `Die value ${dieFace.label}` : "Die value hidden"}
                      style={pokerFxUi.rollStyleByDie[index]}
                      disabled={!canToggleHold}
                      onClick={() => {
                        if (!canToggleHold) return;
                        setPokerDicePendingHolds((previous) => {
                          if (previous.includes(index)) {
                            return previous.filter((entry) => entry !== index);
                          }
                          return [...previous, index].sort((left, right) => left - right);
                        });
                      }}
                    >
                      <span className={`poker-cube${Number.isInteger(dieValue) ? ` show-${dieValue}` : ""}`}>
                        {POKER_DICE_FACE_VALUES.map((faceValue) => (
                          <span
                            key={`pd-face-${index}-${faceValue}`}
                            className={`poker-cube-face face-${faceValue}`}
                            style={pokerContext.isPreRollForViewer ? undefined : getPokerDieFaceStyle(faceValue)}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={`poker-dice-actions${pokerContext.showPassPlay ? " is-pass-only" : ""}`}>
                <Button
                  id="poker-dice-roll"
                  className={`compact-action${pokerContext.showPassPlay ? " hidden" : ""}${pokerPreRollCoach.mode === "ready_to_roll" ? " is-preroll-cta" : ""}`}
                  disabled={!pokerContext.canInteract || pokerContext.rollsUsed >= 3 || Boolean(pokerContext.myFinal?.category) || pokerIsFxRolling}
                  onClick={commitPokerRoll}
                >
                  {pokerContext.rollsUsed < 1 ? "Roll" : `Roll (${pokerContext.rollsUsed}/3)`}
                </Button>
                <Button
                  id="poker-dice-bank"
                  variant="ghost"
                  className={`compact-action${pokerContext.showPassPlay || pokerContext.showInitialRollOnly ? " hidden" : ""}`}
                  disabled={!pokerContext.canInteract || pokerContext.rollsUsed < 1 || Boolean(pokerContext.myFinal?.category) || pokerIsFxRolling}
                  onClick={commitPokerBank}
                >
                  Bank
                </Button>
                <Button
                  id="poker-dice-pass-play"
                  variant="ghost"
                  className={`compact-action${pokerContext.showPassPlay ? "" : " hidden"}`}
                  disabled={!pokerContext.showPassPlay}
                  onClick={handlePokerPassPlay}
                >
                  Pass play
                </Button>
                <Button
                  id="poker-dice-clear-hold"
                  variant="ghost"
                  className={`compact-action${pokerContext.showPassPlay || pokerContext.showInitialRollOnly ? " hidden" : ""}`}
                  disabled={!pokerContext.canInteract || pokerDicePendingHolds.length === 0 || pokerIsFxRolling}
                  onClick={() => setPokerDicePendingHolds([])}
                >
                  Clear holds
                </Button>
              </div>

              <section className="poker-dice-score-guide" aria-label="Poker hand scores">
                <h3 className="poker-dice-score-guide-title">Poker hand scores</h3>
                <div className="poker-dice-score-rows">
                  {[
                    ["royal_flush", "Royal flush", "16 pts"],
                    ["flush", "Straight flush", "12 pts"],
                    ["five_kind", "Five of a kind", "10 pts"],
                    ["four_kind", "Four of a kind", "8 pts"],
                    ["full_house", "Full house", "6 pts"],
                    ["three_kind", "Three of a kind", "4 pts"],
                    ["two_pair", "Two pair", "2 pts"],
                    ["one_pair", "One pair", "0 pts"]
                  ].map(([category, label, points]) => (
                    <div
                      key={`pd-score-${category}`}
                      className={`poker-dice-score-row${pokerProjectedGuideCategory === category ? " is-projected" : ""}`}
                      data-poker-category={category}
                    >
                      <strong>{label}</strong>
                      <span>{points}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </GameSurfaceShell>
        </div>
      </Screen>

      <Screen id="screen-pass" active={activeScreen === "pass"}>
        <div className="panel pass-panel">
          <h2 id="pass-title">Pass the device</h2>
          <p id="pass-message" className="subtext">{localPrivacy.prompt || "Hand over to the next player, then continue."}</p>
          <div className="button-row winner-actions">
            <Button id="pass-ready" onClick={acknowledgePass}>Ready</Button>
          </div>
        </div>
      </Screen>

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

      <ScreenGuardBoundary canRender={isDevBuild}>
        <Screen id="screen-devkit" active={activeScreen === "devkit"}>
          <DevKitchenScreen />
        </Screen>
      </ScreenGuardBoundary>
    </>
  );
}
