import type { CSSProperties } from "react";
import { normalizeRoomCode } from "../../../net/hashRoute.js";
import { getLocalGame, listLocalGames } from "../../../domain/localGames.js";
import { shouldShowLocalPassScreen } from "../../../domain/localPrivacy.js";
import playerAvatar from "../../../assets/player.svg";
import playerAvatarAlt from "../../../assets/player2.svg";
import pokerDieAceFace from "../../../assets/games/Poker Dice/die-Ace.svg";
import pokerDieKingFace from "../../../assets/games/Poker Dice/die-king.svg";
import pokerDieQueenFace from "../../../assets/games/Poker Dice/die-queen.svg";
import pokerDieJackFace from "../../../assets/games/Poker Dice/die-jack.svg";
import pokerDieTenFace from "../../../assets/games/Poker Dice/die-10.svg";
import pokerDieNineFace from "../../../assets/games/Poker Dice/die-9.svg";
import type { Player, RoomState, ScreenKey, ThemeKey } from "../../../types";

export const JOIN_CODE_LENGTH = 4;
export const JOIN_CODE_DISALLOWED_CHARS_REGEX = /[IO]/g;
export const LOCAL_REJOIN_KEY = "multipass_last_local_match";
export const APP_MODE_STORAGE_KEY = "multipass_app_mode";
export const LEGACY_COLLIDED_MODE_STORAGE_KEY = "multipass_mode";
export const WORD_FIGHT_TURN_LIMIT_MS = 90_000;
export const WIN_REASON_HIGHLIGHT_MS = 700;
export const TTT_DRAG_ACTIVATION_PX = 10;
export const TTT_CLICK_SUPPRESS_MS = 320;
export const POKER_DICE_HAND_SIZE = 6;
export const POKER_DICE_ROLL_DURATION_MS = 2000;
export const POKER_DICE_SHUFFLE_MIN_MS = 80;
export const POKER_DICE_SHUFFLE_MAX_MS = 120;
export const POKER_DICE_ROLL_SPEED_MIN_MS = 480;
export const POKER_DICE_ROLL_SPEED_MAX_MS = 620;
export const POKER_DICE_ROLL_DELAY_MAX_MS = 140;
export const POKER_DICE_SETTLE_MS = 220;
export const POKER_DICE_PREROLL_READY_COPY = "Not rolled yet. Tap Roll to open this hand.";

export const SETUP_SHEET_SCREENS = new Set<ScreenKey>(["local", "online", "host", "join"]);
export const ROOM_REQUIRED_SCREENS = new Set<ScreenKey>(["lobby", "pick", "wait", "game", "pass", "winner"]);

export type HonorificValue = "mr" | "mrs";
export type LocalSetupStep = "p1" | "p2";
export type AvatarId = "yellow" | "red" | "green" | "blue";

export interface LocalPrivacyState {
  viewerPlayerId: string | null;
  pendingViewerPlayerId: string | null;
  stage: "visible" | "handoff";
  prompt: string;
}

export interface LocalRejoinSnapshot {
  room: RoomState;
  localPrivacy?: Partial<LocalPrivacyState>;
  pokerDicePendingHolds?: number[];
}

export interface WinRevealState {
  signature: string;
  boardId: "ttt" | "dots_boxes";
  indices: number[];
}

export interface TttGestureState {
  activePointerId: number | null;
  previewIndex: number | null;
  startX: number;
  startY: number;
  isDragging: boolean;
  suppressClickUntil: number;
}

export interface PokerProjectedHand {
  category: string;
}

export interface PokerFxUiState {
  rollingIndices: number[];
  settlingIndices: number[];
  rollStyleByDie: Record<number, CSSProperties>;
  displayFacesByDie: Record<number, number>;
  waitingForResolution: boolean;
}

export interface PokerFxInternalState {
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

export interface AvatarOption {
  id: AvatarId;
  name: string;
  theme: ThemeKey;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "red", name: "Red", theme: "red" },
  { id: "yellow", name: "Yellow", theme: "yellow" },
  { id: "green", name: "Green", theme: "green" },
  { id: "blue", name: "Blue", theme: "blue" }
];

export const POKER_DICE_FACE_VALUES = [1, 2, 3, 4, 5, 6];
export const POKER_DICE_FACE_ASSETS = Object.freeze({
  1: Object.freeze({ label: "Ace", src: pokerDieAceFace }),
  2: Object.freeze({ label: "King", src: pokerDieKingFace }),
  3: Object.freeze({ label: "Queen", src: pokerDieQueenFace }),
  4: Object.freeze({ label: "Jack", src: pokerDieJackFace }),
  5: Object.freeze({ label: "10", src: pokerDieTenFace }),
  6: Object.freeze({ label: "9", src: pokerDieNineFace })
});


export function getPokerDieFace(value: unknown): { label: string; src: string } | null {
  const normalized = Number(value);
  if (!Number.isInteger(normalized)) return null;
  return POKER_DICE_FACE_ASSETS[normalized as keyof typeof POKER_DICE_FACE_ASSETS] || null;
}

export function buildPokerRollStyle(delayMs: number, speedMs: number): CSSProperties {
  return {
    "--pd-roll-delay-ms": `${Math.max(0, Math.round(delayMs))}ms`,
    "--pd-roll-speed-ms": `${Math.max(300, Math.round(speedMs))}ms`
  } as CSSProperties;
}

export function getPokerDieFaceStyle(value: number): CSSProperties | undefined {
  const face = getPokerDieFace(value);
  if (!face) return undefined;
  return { "--poker-cube-face-image": `url("${face.src}")` } as CSSProperties;
}

export function createInitialPokerFxUiState(): PokerFxUiState {
  return {
    rollingIndices: [],
    settlingIndices: [],
    rollStyleByDie: {},
    displayFacesByDie: {},
    waitingForResolution: false
  };
}

export function createInitialPokerFxInternalState(): PokerFxInternalState {
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

export function randomBetween(min: number, max: number): number {
  const low = Number(min);
  const high = Number(max);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return Math.round(low);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

export function getPokerDiceValuesKey(values: Array<number | null> = []): string {
  if (!Array.isArray(values) || !values.length) return "";
  return values
    .map((value) => (Number.isInteger(Number(value)) ? Number(value) : ""))
    .join(",");
}


export function sanitizeJoinCode(rawCode: string): string {
  return normalizeRoomCode(rawCode)
    .replace(JOIN_CODE_DISALLOWED_CHARS_REGEX, "")
    .slice(0, JOIN_CODE_LENGTH);
}

export function resolveScreenLayer(screen: ScreenKey): string {
  if (screen === "landing") return "landing";
  if (SETUP_SHEET_SCREENS.has(screen)) return "setup-sheet";
  return "game-space";
}

export function resolveOnlineRoomScreen(room: RoomState | null): ScreenKey {
  return room?.game ? "game" : "lobby";
}

export function formatStartedAgo(startedAt: number | null): string {
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

export function normalizeHonorific(value: unknown): HonorificValue {
  return String(value || "").trim().toLowerCase() === "mrs" ? "mrs" : "mr";
}

export function formatHonorificName(baseName: string, honorific: HonorificValue): string {
  return `${honorific === "mrs" ? "Mrs" : "Mr"} ${baseName}`;
}

export function getPlayerArtSrc(honorific: HonorificValue): string {
  return honorific === "mrs" ? playerAvatarAlt : playerAvatar;
}

export function getDisplayPlayerName(player: Player | null | undefined, fallback: string): string {
  const raw = String(player?.name || "").trim();
  return raw || fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function asNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function isAvatarId(value: string | null | undefined): value is AvatarId {
  return value === "yellow" || value === "red" || value === "green" || value === "blue";
}

export function getAvatarById(avatarId: AvatarId): AvatarOption {
  const found = AVATAR_OPTIONS.find((entry) => entry.id === avatarId);
  if (found) return found;
  return AVATAR_OPTIONS[0];
}

export function resolveLocalViewerId(room: RoomState | null, currentViewerId: string | null): string | null {
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

export function playerById(room: RoomState | null, playerId: string | null): Player | null {
  if (!room || !playerId) return null;
  if (room.players.host?.id === playerId) return room.players.host;
  if (room.players.guest?.id === playerId) return room.players.guest;
  return null;
}

export function getLeaderId(players: Array<Player | null>): string | null {
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

export function getCountdownSecondsRemaining(countdownEndsAt: number | null, nowTick: number): number | null {
  if (!countdownEndsAt) return null;
  const msLeft = Math.max(0, countdownEndsAt - nowTick);
  if (msLeft <= 0) return 0;
  return Math.max(1, Math.ceil(msLeft / 1000));
}

export function getGameBannerClass(gameId: string | null | undefined): string {
  const key = String(gameId || "").trim().toLowerCase();
  if (key === "dots_and_boxes" || key === "dots") return "game-banner-dots-and-boxes";
  if (key === "word_fight" || key === "words") return "game-banner-word-fight";
  if (key === "poker_dice" || key === "poker") return "game-banner-poker-dice";
  return "game-banner-tic-tac-toe";
}

export function getGameName(room: RoomState | null, gameId: string | null): string {
  if (!room || !gameId) return "that game";
  const fromRoom = (room.games || []).find((game) => game.id === gameId)?.name;
  if (fromRoom) return fromRoom;
  const localGame = getLocalGame(gameId) as { name?: string } | null;
  return String(localGame?.name || gameId);
}

export function createLocalRoom(
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

export function getOtherLocalPlayerId(room: RoomState, currentPlayerId: string | null): string | null {
  const players = [room.players.host, room.players.guest].filter(Boolean) as Player[];
  const next = players.find((player) => player.id !== currentPlayerId);
  return next?.id || null;
}

export function resolveNextLocalRoundStarter(room: RoomState): string | null {
  const hostId = room.players.host?.id || null;
  const currentStarter = room.round?.firstPlayerId || room.round?.pickerId || hostId;
  if (!currentStarter) return hostId;
  return getOtherLocalPlayerId(room, currentStarter) || hostId;
}

export function getDisplayStateForRoomGame(
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

export function getEndSignature(room: RoomState | null): string | null {
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

export function normalizeWinRevealReason(rawReason: unknown): WinRevealState | null {
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

export function getWinRevealReason(room: RoomState | null): WinRevealState | null {
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

export function getDotsGeometry(stateGame: Record<string, unknown>) {
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

export function getDotsBoxEdgeIndices(boxIndex: number, geometry: ReturnType<typeof getDotsGeometry>): [number, number, number, number] {
  const row = Math.floor(boxIndex / geometry.boxSpan);
  const col = boxIndex % geometry.boxSpan;
  const top = row * geometry.boxSpan + col;
  const bottom = (row + 1) * geometry.boxSpan + col;
  const left = geometry.horizontalEdgeCount + (row * geometry.dotCount) + col;
  const right = geometry.horizontalEdgeCount + (row * geometry.dotCount) + (col + 1);
  return [top, bottom, left, right];
}

export function getDotsHotBoxIndices(stateGame: Record<string, unknown>, geometry: ReturnType<typeof getDotsGeometry>): number[] {
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

export function getDotsScoringEdgeIndices(
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

export function getLastDotsMoveEdgeIndex(stateGame: Record<string, unknown>): number | null {
  const history = Array.isArray(stateGame.history) ? stateGame.history : [];
  if (!history.length) return null;
  const last = asRecord(history[history.length - 1]);
  const edgeIndex = asNumber(last.edgeIndex, Number.NaN);
  return Number.isInteger(edgeIndex) ? edgeIndex : null;
}

export function getWordFightTurnMsRemaining(stateGame: Record<string, unknown>, nowTick: number): number {
  const isFinished = Boolean(stateGame.winnerId || stateGame.draw || !stateGame.nextPlayerId);
  if (isFinished) return 0;
  const startedAt = asNumber(stateGame.turnStartedAt, nowTick);
  const elapsed = Math.max(0, nowTick - startedAt);
  return Math.max(0, WORD_FIGHT_TURN_LIMIT_MS - elapsed);
}

export function formatWordFightTurnClock(msRemaining: number): string {
  const safeMs = Math.max(0, asNumber(msRemaining, 0));
  const totalSeconds = safeMs > 0 ? Math.ceil(safeMs / 1000) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function resolveWordFightKeyboardState(entries: Array<Record<string, unknown>>): Record<string, "exact" | "present" | "absent"> {
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

export function classifyPokerProjection(diceValues: unknown): PokerProjectedHand | null {
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

export function resolveLocalRoomScreen(
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

export function loadLocalRejoinSnapshot(): LocalRejoinSnapshot | null {
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

export function saveLocalRejoinSnapshot(snapshot: LocalRejoinSnapshot | null) {
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
