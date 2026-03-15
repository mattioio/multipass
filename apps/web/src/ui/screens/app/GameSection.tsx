import type { CSSProperties } from "react";
import type { RoomState, ScreenKey } from "../../../types";
import { getLocalGame } from "../../../domain/localGames.js";
import {
  Button,
  Screen
} from "../../components";
import {
  GameActionRow,
  GameSurfaceShell,
  TurnStatusBar
} from "../../patterns";
import type { UseTicTacToeGameResult } from "./useTicTacToeGame";
import type { UseDotsAndBoxesGameResult } from "./useDotsAndBoxesGame";
import type { UseWordFightGameResult } from "./useWordFightGame";
import type { UsePokerDiceGameResult } from "./usePokerDiceGame";
import type { WinRevealState } from "./appScreensUtils";
import {
  asRecord,
  asNumber,
  playerById,
  POKER_DICE_FACE_VALUES,
  getPokerDieFace,
  getPokerDieFaceStyle,
  formatWordFightTurnClock,
} from "./appScreensUtils";

export interface GameSectionProps {
  activeScreen: ScreenKey;
  activeRoom: RoomState | null;
  activeDisplayState: Record<string, unknown> | null;
  activeGameId: string | null;
  activeGameWinnerId: string | null;
  turnBarMode: "idle" | "turn" | "winner" | "draw";
  turnBarActivePlayerId: string | null;
  showEndGameButton: boolean;
  isEndRequester: boolean;
  endButtonLabel: string;
  showNewRoundButton: boolean;
  newRoundButtonLabel: string;
  winReveal: WinRevealState | null;
  onCloseBoard: () => void;
  onEndGame: () => void;
  onNewRound: () => void;

  // TTT game
  tttBoardRef: UseTicTacToeGameResult["tttBoardRef"];
  tttGestureRef: UseTicTacToeGameResult["tttGestureRef"];
  tttState: UseTicTacToeGameResult["tttState"];
  isTicTacToeCellPlayable: UseTicTacToeGameResult["isTicTacToeCellPlayable"];
  handleTttPointerDown: UseTicTacToeGameResult["handleTttPointerDown"];
  handleTttPointerMove: UseTicTacToeGameResult["handleTttPointerMove"];
  handleTttPointerUp: UseTicTacToeGameResult["handleTttPointerUp"];
  handleTttPointerCancel: UseTicTacToeGameResult["handleTttPointerCancel"];
  handleTttClick: UseTicTacToeGameResult["handleTttClick"];

  // Dots game
  dotsState: UseDotsAndBoxesGameResult["dotsState"];
  dotsGeometry: UseDotsAndBoxesGameResult["dotsGeometry"];
  dotsHotBoxIndices: UseDotsAndBoxesGameResult["dotsHotBoxIndices"];
  dotsScoringEdges: UseDotsAndBoxesGameResult["dotsScoringEdges"];
  dotsLastEdgeIndex: UseDotsAndBoxesGameResult["dotsLastEdgeIndex"];
  isDotsEdgePlayable: UseDotsAndBoxesGameResult["isDotsEdgePlayable"];
  commitDotsMove: UseDotsAndBoxesGameResult["commitDotsMove"];

  // Word Fight game
  wordFightState: UseWordFightGameResult["wordFightState"];
  wordFightDraft: UseWordFightGameResult["wordFightDraft"];
  wordFightContext: UseWordFightGameResult["wordFightContext"];
  wordFightActiveEntries: UseWordFightGameResult["wordFightActiveEntries"];
  wordFightKeyboardState: UseWordFightGameResult["wordFightKeyboardState"];
  wordFightTimerMs: number;
  wordFightHint: string;
  handleWordFightKey: UseWordFightGameResult["handleWordFightKey"];
  handleWordFightPassTurn: UseWordFightGameResult["handleWordFightPassTurn"];

  // Poker Dice game
  pokerState: UsePokerDiceGameResult["pokerState"];
  pokerDicePendingHolds: UsePokerDiceGameResult["pokerDicePendingHolds"];
  setPokerDicePendingHolds: UsePokerDiceGameResult["setPokerDicePendingHolds"];
  pokerFxUi: UsePokerDiceGameResult["pokerFxUi"];
  pokerProjectedGuideCategory: UsePokerDiceGameResult["pokerProjectedGuideCategory"];
  pokerContext: UsePokerDiceGameResult["pokerContext"];
  pokerIsFxRolling: UsePokerDiceGameResult["pokerIsFxRolling"];
  pokerPreRollCoach: UsePokerDiceGameResult["pokerPreRollCoach"];
  pokerRenderedDice: UsePokerDiceGameResult["pokerRenderedDice"];
  commitPokerRoll: UsePokerDiceGameResult["commitPokerRoll"];
  commitPokerBank: UsePokerDiceGameResult["commitPokerBank"];
  handlePokerPassPlay: UsePokerDiceGameResult["handlePokerPassPlay"];
}

export function GameSection({
  activeScreen,
  activeRoom,
  activeDisplayState,
  activeGameId,
  activeGameWinnerId,
  turnBarMode,
  turnBarActivePlayerId,
  showEndGameButton,
  isEndRequester,
  endButtonLabel,
  showNewRoundButton,
  newRoundButtonLabel,
  winReveal,
  onCloseBoard,
  onEndGame,
  onNewRound,
  tttBoardRef,
  tttGestureRef,
  tttState,
  isTicTacToeCellPlayable,
  handleTttPointerDown,
  handleTttPointerMove,
  handleTttPointerUp,
  handleTttPointerCancel,
  handleTttClick,
  dotsState,
  dotsGeometry,
  dotsHotBoxIndices,
  dotsScoringEdges,
  dotsLastEdgeIndex,
  isDotsEdgePlayable,
  commitDotsMove,
  wordFightState,
  wordFightDraft,
  wordFightContext,
  wordFightActiveEntries,
  wordFightKeyboardState,
  wordFightTimerMs,
  wordFightHint,
  handleWordFightKey,
  handleWordFightPassTurn,
  pokerState,
  pokerDicePendingHolds,
  setPokerDicePendingHolds,
  pokerFxUi,
  pokerProjectedGuideCategory,
  pokerContext,
  pokerIsFxRolling,
  pokerPreRollCoach,
  pokerRenderedDice,
  commitPokerRoll,
  commitPokerBank,
  handlePokerPassPlay,
}: GameSectionProps) {
  return (
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
                id="end-game-game"
                variant="ghost"
                className={showEndGameButton ? "" : "hidden"}
                onClick={onEndGame}
                disabled={isEndRequester}
              >
                {endButtonLabel}
              </Button>

              <Button
                id="new-round"
                variant="ghost"
                className={showNewRoundButton ? "" : "hidden"}
                onClick={onNewRound}
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
                      const buttonLabel = keyLabel === "BACKSPACE" ? "\u232B" : keyLabel;
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
  );
}
