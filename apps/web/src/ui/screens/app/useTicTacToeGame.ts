import { useCallback, useMemo, useRef } from "react";
import type { RoomState } from "../../../types";
import {
  asRecord,
  asNumber,
  TTT_DRAG_ACTIVATION_PX,
  TTT_CLICK_SUPPRESS_MS,
  type TttGestureState,
} from "./appScreensUtils";

export interface UseTicTacToeGameParams {
  activeRoom: RoomState | null;
  activeDisplayState: Record<string, unknown> | null;
  activeGameWinnerId: string | null;
  activeGameDraw: boolean;
  canActOnTurn: (nextPlayerId: string | null) => boolean;
  sendMove: (move: Record<string, unknown>) => boolean;
}

export interface UseTicTacToeGameResult {
  tttBoardRef: React.MutableRefObject<HTMLDivElement | null>;
  tttGestureRef: React.MutableRefObject<TttGestureState>;
  tttState: Record<string, unknown> | null;
  isTicTacToeCellPlayable: (index: number) => boolean;
  getTttIndexFromTarget: (target: EventTarget | null) => number | null;
  commitTttMove: (index: number) => boolean;
  handleTttPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleTttPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleTttPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleTttPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleTttClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function useTicTacToeGame(params: UseTicTacToeGameParams): UseTicTacToeGameResult {
  const {
    activeRoom,
    activeDisplayState,
    activeGameWinnerId,
    activeGameDraw,
    canActOnTurn,
    sendMove,
  } = params;

  const tttBoardRef = useRef<HTMLDivElement | null>(null);
  const tttGestureRef = useRef<TttGestureState>({
    activePointerId: null,
    previewIndex: null,
    startX: 0,
    startY: 0,
    isDragging: false,
    suppressClickUntil: 0,
  });

  const tttState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "tic_tac_toe") return null;
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

  const clearTttGesture = useCallback(() => {
    tttGestureRef.current.activePointerId = null;
    tttGestureRef.current.previewIndex = null;
    tttGestureRef.current.startX = 0;
    tttGestureRef.current.startY = 0;
    tttGestureRef.current.isDragging = false;
  }, []);

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

  return {
    tttBoardRef,
    tttGestureRef,
    tttState,
    isTicTacToeCellPlayable,
    getTttIndexFromTarget,
    commitTttMove,
    handleTttPointerDown,
    handleTttPointerMove,
    handleTttPointerUp,
    handleTttPointerCancel,
    handleTttClick,
  };
}
