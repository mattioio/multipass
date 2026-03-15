import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RoomState, ScreenKey } from "../../../types";
import {
  asRecord,
  asNumber,
  playerById,
  getDisplayPlayerName,
  classifyPokerProjection,
  POKER_DICE_HAND_SIZE,
  POKER_DICE_ROLL_DURATION_MS,
  POKER_DICE_SHUFFLE_MIN_MS,
  POKER_DICE_SHUFFLE_MAX_MS,
  POKER_DICE_ROLL_SPEED_MIN_MS,
  POKER_DICE_ROLL_SPEED_MAX_MS,
  POKER_DICE_ROLL_DELAY_MAX_MS,
  POKER_DICE_SETTLE_MS,
  POKER_DICE_PREROLL_READY_COPY,
  POKER_DICE_FACE_VALUES,
  buildPokerRollStyle,
  createInitialPokerFxUiState,
  createInitialPokerFxInternalState,
  randomBetween,
  getPokerDiceValuesKey,
  type PokerFxUiState,
  type PokerFxInternalState,
  type LocalPrivacyState,
} from "./appScreensUtils";

export interface UsePokerDiceGameParams {
  activeRoom: RoomState | null;
  activeDisplayState: Record<string, unknown> | null;
  isLocalMode: boolean;
  localViewerId: string | null;
  activeYou: { playerId: string | null; role: string | null };
  localPrivacy: LocalPrivacyState;
  pokerPassTargetPlayerId: string | null;
  sendMove: (move: Record<string, unknown>) => boolean;
  updateLocalRoomState: (nextRoom: RoomState, nextPrivacy: LocalPrivacyState, pendingHolds: number[]) => void;
  localRoom: RoomState | null;
  goTo: (screen: ScreenKey, options?: { replace?: boolean }) => void;
  setPokerPassTargetPlayerId: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface PokerContext {
  canInteract: boolean;
  isFinished: boolean;
  localBlocked: boolean;
  rollsUsed: number;
  currentHandNumber: number;
  diceCount: number;
  dice: Array<number | null>;
  locks: boolean[];
  myFinal: Record<string, unknown> | null;
  nextPlayerId: string | null;
  openingRollPending: boolean;
  showPassPlay: boolean;
  showInitialRollOnly: boolean;
  isPreRollForViewer: boolean;
  isMyTurn: boolean;
  projectedCategory: string | null;
}

export interface PokerPreRollCoach {
  mode: "hidden" | "ready_to_roll" | "waiting_for_opening_roll";
  message: string;
}

export interface UsePokerDiceGameResult {
  pokerState: Record<string, unknown> | null;
  pokerDicePendingHolds: number[];
  setPokerDicePendingHolds: React.Dispatch<React.SetStateAction<number[]>>;
  pokerFxUi: PokerFxUiState;
  pokerProjectedGuideCategory: string | null;
  pokerContext: PokerContext;
  pokerViewerPlayerId: string | null;
  pokerIsFxRolling: boolean;
  pokerPreRollCoach: PokerPreRollCoach;
  pokerRenderedDice: Array<number | null>;
  commitPokerRoll: () => void;
  commitPokerBank: () => void;
  handlePokerPassPlay: () => void;
  resetPokerFxState: () => void;
}

export function usePokerDiceGame(params: UsePokerDiceGameParams): UsePokerDiceGameResult {
  const {
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
  } = params;

  const [pokerDicePendingHolds, setPokerDicePendingHolds] = useState<number[]>([]);
  const [pokerFxUi, setPokerFxUi] = useState<PokerFxUiState>(() => createInitialPokerFxUiState());
  const [pokerProjectedGuideCategory, setPokerProjectedGuideCategory] = useState<string | null>(null);

  const pokerFxRef = useRef<PokerFxInternalState>(createInitialPokerFxInternalState());
  const pokerServerDiceRef = useRef<Array<number | null>>([]);
  const pokerServerRollsUsedRef = useRef(0);
  const pokerViewerPlayerRef = useRef<string | null>(null);

  const pokerState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "poker_dice") return null;
    return asRecord(activeDisplayState ?? activeRoom.game.state);
  }, [activeDisplayState, activeRoom]);

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
        projectedCategory: null as string | null,
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
      projectedCategory: projected?.category || null,
    };
  }, [
    activeYou.role,
    isLocalMode,
    localPrivacy.stage,
    pokerPassTargetPlayerId,
    pokerState,
    pokerViewerPlayerId,
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
      displayFacesByDie: {},
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
        rollStyleByDie: {},
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
        startDelayMs: randomBetween(0, POKER_DICE_ROLL_DELAY_MAX_MS),
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
            [index]: nextFace,
          },
        }));
      }, tickMs);
      fx.intervalByIndex.set(index, intervalId);
    }

    setPokerFxUi({
      rollingIndices,
      settlingIndices: [],
      rollStyleByDie: nextRollStyleByDie,
      displayFacesByDie: nextDisplayFacesByDie,
      waitingForResolution: true,
    });

    fx.stopTimeoutId = window.setTimeout(() => {
      const currentFx = pokerFxRef.current;
      if (currentFx.activeRollToken !== rollToken) return;
      maybeFinalizePokerDiceRollFx();
    }, POKER_DICE_ROLL_DURATION_MS);
  }, [maybeFinalizePokerDiceRollFx, resetPokerFxState]);

  // Sync server state into refs for the FX system
  useEffect(() => {
    pokerServerDiceRef.current = pokerContext.dice;
    pokerServerRollsUsedRef.current = pokerContext.rollsUsed;
    pokerViewerPlayerRef.current = pokerViewerPlayerId;
  }, [pokerContext.dice, pokerContext.rollsUsed, pokerViewerPlayerId]);

  // Cleanup on unmount
  useEffect(() => () => {
    resetPokerFxState();
  }, [resetPokerFxState]);

  // Reset FX when poker game goes away
  useEffect(() => {
    if (pokerState) return;
    resetPokerFxState();
    setPokerProjectedGuideCategory(null);
  }, [pokerState, resetPokerFxState]);

  // Attempt finalize when server data arrives
  useEffect(() => {
    if (!pokerFxUi.waitingForResolution) return;
    maybeFinalizePokerDiceRollFx();
  }, [
    maybeFinalizePokerDiceRollFx,
    pokerContext.dice,
    pokerContext.rollsUsed,
    pokerFxUi.waitingForResolution,
    pokerViewerPlayerId,
  ]);

  // Sync pending holds from server locks
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
    pokerState,
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
      viewerPlayerId: pokerViewerPlayerId,
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
    startPokerDiceRollFx,
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
      prompt: "",
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
    setPokerPassTargetPlayerId,
    updateLocalRoomState,
  ]);

  const pokerIsFxRolling = pokerFxUi.waitingForResolution && pokerFxUi.rollingIndices.length > 0;

  const pokerPreRollCoach = useMemo(() => {
    if (!pokerState || !pokerContext.isPreRollForViewer || !pokerContext.openingRollPending) {
      return {
        mode: "hidden" as const,
        message: "",
      };
    }

    if (pokerContext.canInteract) {
      return {
        mode: "ready_to_roll" as const,
        message: POKER_DICE_PREROLL_READY_COPY,
      };
    }

    const openingPlayer = playerById(activeRoom, pokerContext.nextPlayerId);
    const openerName = getDisplayPlayerName(openingPlayer, "the other player");
    return {
      mode: "waiting_for_opening_roll" as const,
      message: `Waiting for ${openerName} to open this hand.`,
    };
  }, [
    activeRoom,
    pokerContext.canInteract,
    pokerContext.isPreRollForViewer,
    pokerContext.nextPlayerId,
    pokerContext.openingRollPending,
    pokerState,
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
    pokerViewerPlayerId,
  ]);

  // Projected guide category
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
    pokerState,
  ]);

  return {
    pokerState,
    pokerDicePendingHolds,
    setPokerDicePendingHolds,
    pokerFxUi,
    pokerProjectedGuideCategory,
    pokerContext,
    pokerViewerPlayerId,
    pokerIsFxRolling,
    pokerPreRollCoach,
    pokerRenderedDice,
    commitPokerRoll,
    commitPokerBank,
    handlePokerPassPlay,
    resetPokerFxState,
  };
}
