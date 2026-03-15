import { useCallback, useMemo } from "react";
import type { RoomState } from "../../../types";
import {
  asRecord,
  getDotsGeometry,
  getDotsHotBoxIndices,
  getDotsScoringEdgeIndices,
  getLastDotsMoveEdgeIndex,
} from "./appScreensUtils";

export interface UseDotsAndBoxesGameParams {
  activeRoom: RoomState | null;
  activeDisplayState: Record<string, unknown> | null;
  activeGameWinnerId: string | null;
  activeGameDraw: boolean;
  canActOnTurn: (nextPlayerId: string | null) => boolean;
  sendMove: (move: Record<string, unknown>) => boolean;
}

export interface DotsGeometry {
  gridSize: number;
  boxSpan: number;
  dotCount: number;
  horizontalEdgeCount: number;
}

export interface UseDotsAndBoxesGameResult {
  dotsState: Record<string, unknown> | null;
  dotsGeometry: DotsGeometry | null;
  dotsHotBoxIndices: number[];
  dotsScoringEdges: Set<number>;
  dotsLastEdgeIndex: number | null;
  isDotsEdgePlayable: (edgeIndex: number) => boolean;
  commitDotsMove: (edgeIndex: number) => void;
}

export function useDotsAndBoxesGame(params: UseDotsAndBoxesGameParams): UseDotsAndBoxesGameResult {
  const {
    activeRoom,
    activeDisplayState,
    activeGameWinnerId,
    activeGameDraw,
    canActOnTurn,
    sendMove,
  } = params;

  const dotsState = useMemo(() => {
    if (!activeRoom?.game) return null;
    if (activeRoom.game.id !== "dots_and_boxes") return null;
    return asRecord(activeDisplayState ?? activeRoom.game.state);
  }, [activeDisplayState, activeRoom]);

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

  return {
    dotsState,
    dotsGeometry,
    dotsHotBoxIndices,
    dotsScoringEdges,
    dotsLastEdgeIndex,
    isDotsEdgePlayable,
    commitDotsMove,
  };
}
