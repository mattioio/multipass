import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRuntime } from "../../../app/runtime";
import {
  confirmLocalHandoff,
  createInitialLocalPrivacyState,
  queueLocalHandoff,
} from "../../../domain/localPrivacy.js";
import { getLocalGame } from "../../../domain/localGames.js";
import { resolvePickerGames } from "../../../domain/games/picker.js";
import type { Player, RoomState, ScreenKey } from "../../../types";
import { Screen } from "../../components";
import { DevKitchenScreen } from "../DevKitchenScreen";
import {
  PlayerStatusStrip,
  ScreenGuardBoundary
} from "../../patterns";
import { useAppRouter } from "../../routing/AppRouter";
import { normalizeTargetScreen } from "../../routing/normalizeScreen";
import {
  JOIN_CODE_LENGTH,
  APP_MODE_STORAGE_KEY,
  LEGACY_COLLIDED_MODE_STORAGE_KEY,
  WIN_REASON_HIGHLIGHT_MS,
  POKER_DICE_HAND_SIZE,
  SETUP_SHEET_SCREENS,
  ROOM_REQUIRED_SCREENS,
  sanitizeJoinCode,
  resolveScreenLayer,
  resolveOnlineRoomScreen,
  formatStartedAgo,
  normalizeHonorific,
  formatHonorificName,
  getPlayerArtSrc,
  getDisplayPlayerName,
  asRecord,
  asNumber,
  isAvatarId,
  getAvatarById,
  resolveLocalViewerId,
  playerById,
  getCountdownSecondsRemaining,
  getGameName,
  createLocalRoom,
  resolveNextLocalRoundStarter,
  getDisplayStateForRoomGame,
  getEndSignature,
  getWinRevealReason,
  resolveLocalRoomScreen,
  loadLocalRejoinSnapshot,
  saveLocalRejoinSnapshot,
  type HonorificValue,
  type LocalSetupStep,
  type AvatarId,
  type LocalPrivacyState,
  type LocalRejoinSnapshot,
  type WinRevealState,
} from "./appScreensUtils";

// Utility constants, types, and functions are in ./appScreensUtils.ts

import { useTicTacToeGame } from "./useTicTacToeGame";
import { useDotsAndBoxesGame } from "./useDotsAndBoxesGame";
import { useWordFightGame } from "./useWordFightGame";
import { usePokerDiceGame } from "./usePokerDiceGame";

import { LandingSection } from "./LandingSection";
import { SetupSheets } from "./SetupSheets";
import { LobbySection } from "./LobbySection";
import { GameSection } from "./GameSection";
import { PassSection } from "./PassSection";
import { WinnerSection } from "./WinnerSection";

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
  const [pokerPassTargetPlayerId, setPokerPassTargetPlayerId] = useState<string | null>(null);
  const [onlineBoardDismissed, setOnlineBoardDismissed] = useState(false);
  const [onlineLeavingToLanding, setOnlineLeavingToLanding] = useState(false);
  const [winReveal, setWinReveal] = useState<WinRevealState | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [closingSetupScreen, setClosingSetupScreen] = useState<ScreenKey | null>(null);

  const modeHydratedRef = useRef(false);
  const deepLinkValidationRef = useRef<string | null>(null);
  const previousOnlineHasGameRef = useRef(false);


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
    localRoom,
    onlineBoardDismissed,
    onlineLeavingToLanding,
    resolvedRoomScreen,
    route.screen
  ]);

  const activeScreen = resolvedScreen;

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
    if (route.screen === resolvedScreen) return;
    goTo(resolvedScreen, { replace: true });
  }, [goTo, resolvedScreen, route.screen]);

  useEffect(() => {
    document.body.dataset.screen = resolvedScreen;
    document.body.dataset.layer = resolveScreenLayer(resolvedScreen);
  }, [resolvedScreen]);

  useEffect(() => {
    if (modeHydratedRef.current) return;
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
  }, [setMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(APP_MODE_STORAGE_KEY, state.mode);
    } catch {
      // Ignore storage failures.
    }
  }, [state.mode]);

  useEffect(() => {
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
  }, [isLocalMode, state.room]);

  useEffect(() => {
    if (!onlineLeavingToLanding) return;
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
  }, [onlineLeavingToLanding, state.room]);

  useEffect(() => {
    if (!isLocalMode || !localRoom) return;
    if (localViewerId && localPrivacy.viewerPlayerId !== localViewerId) {
      setLocalPrivacy((previous) => ({
        ...previous,
        viewerPlayerId: localViewerId
      }));
    }
  }, [isLocalMode, localPrivacy.viewerPlayerId, localRoom, localViewerId]);

  useEffect(() => {
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
  }, [normalizedJoinCode, route.join.code, route.screen, setJoinCode, validateRoom]);

  useEffect(() => {
    if (!joinAvatar) return;
    if (!joinDisabledAvatarIds.includes(joinAvatar)) return;
    setJoinAvatar(null);
  }, [joinAvatar, joinDisabledAvatarIds]);

  useEffect(() => {
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
  }, [activeRoom]);

  /* Nav bar DOM manipulation removed — now declarative via NavBar component in AppLayout */

  const closeSetupSheet = useCallback((screen: ScreenKey) => {
    setClosingSetupScreen(screen);
    window.setTimeout(() => {
      goTo("landing");
      setClosingSetupScreen(null);
    }, 360);
  }, [goTo]);

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

  const handleJoinCodeChange = (code: string) => {
    deepLinkValidationRef.current = null;
    setJoinCode(code);
  };

  const handleJoinCodeComplete = (code: string) => {
    if (code.length !== JOIN_CODE_LENGTH) return;
    validateRoom(code);
  };

  const handleJoinPrimaryAction = () => {
    if (joinStep === "code") {
      if (normalizedJoinCode.length !== JOIN_CODE_LENGTH || state.join.status === "validating") return;
      validateRoom(normalizedJoinCode);
      return;
    }

    if (!joinAvatar && !state.join.preview?.canRejoin) return;
    joinRoom(normalizedJoinCode, joinAvatar, joinHonorific);
  };

  const handleRejoin = () => {
    if (onlineRejoinCode.length !== JOIN_CODE_LENGTH) return;
    setJoinCode(onlineRejoinCode);
    deepLinkValidationRef.current = onlineRejoinCode;
    validateRoom(onlineRejoinCode);
    setMode("online");
    goTo("join");
  };

  const handleClearRejoin = () => {
    setLastRoom(null, null);
  };

  const handleLocalRejoin = () => {
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
  };

  const handleClearLocalRejoin = () => {
    setLocalRejoinSnapshot(null);
    saveLocalRejoinSnapshot(null);
  };

  const handleLocalContinue = () => {
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
  };

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

  // --- Game hooks ---

  const tttGame = useTicTacToeGame({
    activeRoom,
    activeDisplayState,
    activeGameWinnerId,
    activeGameDraw,
    canActOnTurn,
    sendMove,
  });

  const dotsGame = useDotsAndBoxesGame({
    activeRoom,
    activeDisplayState,
    activeGameWinnerId,
    activeGameDraw,
    canActOnTurn,
    sendMove,
  });

  const wordFightGame = useWordFightGame({
    activeRoom,
    activeDisplayState,
    isLocalMode,
    localViewerId,
    activeYou,
    localPrivacy,
    clockTick,
    sendMove,
    updateLocalRoomState,
    localRoom,
    goTo,
  });
  const { setWordFightDraft } = wordFightGame;

  const pokerGame = usePokerDiceGame({
    activeRoom,
    activeDisplayState,
    isLocalMode,
    localViewerId,
    activeYou,
    localPrivacy,
    pokerPassTargetPlayerId,
    sendMove,
    updateLocalRoomState,
    localRoom,
    goTo,
    setPokerPassTargetPlayerId,
  });
  const { pokerDicePendingHolds, setPokerDicePendingHolds } = pokerGame;

  useEffect(() => {
    if (!isLocalMode || !localRoom) return;
    const snapshot: LocalRejoinSnapshot = {
      room: localRoom,
      localPrivacy,
      pokerDicePendingHolds
    };
    setLocalRejoinSnapshot(snapshot);
    saveLocalRejoinSnapshot(snapshot);
  }, [isLocalMode, localPrivacy, localRoom, pokerDicePendingHolds]);

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
      <LandingSection
        activeScreen={activeScreen}
        hasLocalRejoin={hasLocalRejoin}
        localRejoinStartedAt={localRejoinStartedAt}
        hasOnlineRejoin={hasOnlineRejoin}
        onlineRejoinCode={onlineRejoinCode}
        onlineRejoinStartedLabel={onlineRejoinStartedLabel}
        onGoLocal={() => {
          setMode("local");
          goTo("local");
        }}
        onGoOnline={() => {
          setMode("online");
          goTo("online");
        }}
        onLocalRejoin={handleLocalRejoin}
        onClearLocalRejoin={handleClearLocalRejoin}
        onRejoin={handleRejoin}
        onClearRejoin={handleClearRejoin}
      />

      <SetupSheets
        activeScreen={activeScreen}
        closingSetupScreen={closingSetupScreen}
        closeSetupSheetFor={closeSetupSheetFor}
        localStep={localStep}
        localHonorifics={localHonorifics}
        currentLocalAvatarId={currentLocalAvatarId}
        localAvatars={localAvatars}
        localCtaDisabled={localCtaDisabled}
        localCtaLabel={localCtaLabel}
        onLocalHonorificChange={(step, checked) => {
          setLocalHonorifics((previous) => {
            if (step === "p1") {
              return { ...previous, p1: checked ? "mrs" : "mr" };
            }
            return { ...previous, p2: checked ? "mrs" : "mr" };
          });
        }}
        onLocalAvatarSelect={(step, avatarId) => {
          if (step === "p1") {
            setLocalAvatars((previous) => ({ ...previous, one: avatarId }));
            return;
          }
          if (localAvatars.one === avatarId) return;
          setLocalAvatars((previous) => ({ ...previous, two: avatarId }));
        }}
        onLocalContinue={handleLocalContinue}
        onGoHost={() => {
          setMode("online");
          goTo("host");
        }}
        onGoJoin={() => {
          setMode("online");
          goTo("join");
        }}
        hostAvatar={hostAvatar}
        hostHonorific={hostHonorific}
        onHostAvatarSelect={setHostAvatar}
        onHostHonorificChange={(checked) => setHostHonorific(checked ? "mrs" : "mr")}
        onCreateRoom={() => {
          if (!hostAvatar) return;
          setMode("online");
          createRoom(hostAvatar, hostHonorific);
        }}
        normalizedJoinCode={normalizedJoinCode}
        joinStatusMessage={joinStatusMessage}
        joinValidating={state.join.status === "validating"}
        joinStep={joinStep}
        joinAvatar={joinAvatar}
        joinDisabledAvatarIds={joinDisabledAvatarIds}
        joinHonorific={joinHonorific}
        joinHostAvatarId={joinHostAvatarId}
        joinLockedAvatarLabel={joinLockedAvatarLabel}
        joinLockedAvatarArtSrc={joinLockedAvatarArtSrc}
        joinCtaDisabled={joinCtaDisabled}
        joinCtaLabel={joinCtaLabel}
        onJoinCodeChange={handleJoinCodeChange}
        onJoinCodeComplete={handleJoinCodeComplete}
        onJoinAvatarSelect={setJoinAvatar}
        onJoinHonorificChange={setJoinHonorific}
        onJoinPrimaryAction={handleJoinPrimaryAction}
      />

      <LobbySection
        activeScreen={activeScreen}
        activeRoom={activeRoom}
        isLocalMode={isLocalMode}
        activeYouRole={activeYou.role}
        currentGameEnded={currentGameEnded}
        lobbyGames={lobbyGames}
        lobbyStatusMessage={lobbyStatusMessage}
        onlineHostChoiceId={onlineHostChoiceId}
        onlineGuestChoiceId={onlineGuestChoiceId}
        resolvedChoiceId={resolvedChoiceId}
        onlineCountdownActive={onlineCountdownActive}
        onlineCountdownSeconds={onlineCountdownSeconds}
        onSelectLobbyGame={handleSelectLobbyGame}
      />

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

      <GameSection
        activeScreen={activeScreen}
        activeRoom={activeRoom}
        activeDisplayState={activeDisplayState}
        activeGameId={activeGameId}
        activeGameWinnerId={activeGameWinnerId}
        turnBarMode={turnBarMode}
        turnBarActivePlayerId={turnBarActivePlayerId}
        showEndGameButton={showEndGameButton}
        isEndRequester={isEndRequester}
        endButtonLabel={endButtonLabel}
        showNewRoundButton={showNewRoundButton}
        newRoundButtonLabel={newRoundButtonLabel}
        winReveal={winReveal}
        onCloseBoard={handleCloseBoard}
        onEndGame={handleEndGame}
        onNewRound={handleNewRound}
        tttBoardRef={tttGame.tttBoardRef}
        tttGestureRef={tttGame.tttGestureRef}
        tttState={tttGame.tttState}
        isTicTacToeCellPlayable={tttGame.isTicTacToeCellPlayable}
        handleTttPointerDown={tttGame.handleTttPointerDown}
        handleTttPointerMove={tttGame.handleTttPointerMove}
        handleTttPointerUp={tttGame.handleTttPointerUp}
        handleTttPointerCancel={tttGame.handleTttPointerCancel}
        handleTttClick={tttGame.handleTttClick}
        dotsState={dotsGame.dotsState}
        dotsGeometry={dotsGame.dotsGeometry}
        dotsHotBoxIndices={dotsGame.dotsHotBoxIndices}
        dotsScoringEdges={dotsGame.dotsScoringEdges}
        dotsLastEdgeIndex={dotsGame.dotsLastEdgeIndex}
        isDotsEdgePlayable={dotsGame.isDotsEdgePlayable}
        commitDotsMove={dotsGame.commitDotsMove}
        wordFightState={wordFightGame.wordFightState}
        wordFightDraft={wordFightGame.wordFightDraft}
        wordFightContext={wordFightGame.wordFightContext}
        wordFightActiveEntries={wordFightGame.wordFightActiveEntries}
        wordFightKeyboardState={wordFightGame.wordFightKeyboardState}
        wordFightTimerMs={wordFightGame.wordFightTimerMs}
        wordFightHint={wordFightGame.wordFightHint}
        handleWordFightKey={wordFightGame.handleWordFightKey}
        handleWordFightPassTurn={wordFightGame.handleWordFightPassTurn}
        pokerState={pokerGame.pokerState}
        pokerDicePendingHolds={pokerGame.pokerDicePendingHolds}
        setPokerDicePendingHolds={pokerGame.setPokerDicePendingHolds}
        pokerFxUi={pokerGame.pokerFxUi}
        pokerProjectedGuideCategory={pokerGame.pokerProjectedGuideCategory}
        pokerContext={pokerGame.pokerContext}
        pokerIsFxRolling={pokerGame.pokerIsFxRolling}
        pokerPreRollCoach={pokerGame.pokerPreRollCoach}
        pokerRenderedDice={pokerGame.pokerRenderedDice}
        commitPokerRoll={pokerGame.commitPokerRoll}
        commitPokerBank={pokerGame.commitPokerBank}
        handlePokerPassPlay={pokerGame.handlePokerPassPlay}
      />

      <PassSection
        activeScreen={activeScreen}
        prompt={localPrivacy.prompt}
        onReady={acknowledgePass}
      />

      <WinnerSection
        activeScreen={activeScreen}
        activeRoom={activeRoom}
        activeGameWinnerId={activeGameWinnerId}
        activeGameDraw={activeGameDraw}
      />

      <ScreenGuardBoundary canRender={isDevBuild}>
        <Screen id="screen-devkit" active={activeScreen === "devkit"}>
          <DevKitchenScreen />
        </Screen>
      </ScreenGuardBoundary>
    </>
  );
}
