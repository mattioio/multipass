import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmLocalHandoff } from "../../../domain/localPrivacy.js";
import type { RoomState, ScreenKey } from "../../../types";
import {
  asRecord,
  getWordFightTurnMsRemaining,
  resolveWordFightKeyboardState,
  type LocalPrivacyState,
} from "./appScreensUtils";

export interface UseWordFightGameParams {
  activeRoom: RoomState | null;
  activeDisplayState: Record<string, unknown> | null;
  isLocalMode: boolean;
  localViewerId: string | null;
  activeYou: { playerId: string | null; role: string | null };
  localPrivacy: LocalPrivacyState;
  clockTick: number;
  sendMove: (move: Record<string, unknown>) => boolean;
  updateLocalRoomState: (nextRoom: RoomState, nextPrivacy: LocalPrivacyState, pendingHolds: number[]) => void;
  localRoom: RoomState | null;
  goTo: (screen: ScreenKey, options?: { replace?: boolean }) => void;
}

export interface WordFightContext {
  canType: boolean;
  localBlocked: boolean;
  isFinished: boolean;
  showPassTurn: boolean;
  viewerPlayerId: string | null;
  activeBoardPlayerId: string | null;
  revealExhaustedWord: boolean;
  exhaustedWord: string;
}

export interface UseWordFightGameResult {
  wordFightState: Record<string, unknown> | null;
  wordFightDraft: string;
  wordFightContext: WordFightContext;
  wordFightActiveEntries: Array<Record<string, unknown>>;
  wordFightKeyboardState: Record<string, string | null>;
  wordFightTimerMs: number;
  wordFightHint: string;
  handleWordFightKey: (key: string) => void;
  handleWordFightPassTurn: () => void;
  setWordFightDraft: React.Dispatch<React.SetStateAction<string>>;
}

export function useWordFightGame(params: UseWordFightGameParams): UseWordFightGameResult {
  const {
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
  } = params;

  const [wordFightDraft, setWordFightDraft] = useState("");

  const wordFightState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "word_fight") return null;
    return asRecord(activeDisplayState ?? activeRoom.game.state);
  }, [activeDisplayState, activeRoom]);

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
        exhaustedWord: "",
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
      exhaustedWord,
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

  return {
    wordFightState,
    wordFightDraft,
    wordFightContext,
    wordFightActiveEntries,
    wordFightKeyboardState,
    wordFightTimerMs,
    wordFightHint,
    handleWordFightKey,
    handleWordFightPassTurn,
    setWordFightDraft,
  };
}
