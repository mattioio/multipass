import { WORD_FIGHT_SECRET_WORDS, isWordFightWord } from "./wordFightWords.js";
import {
  WORD_FIGHT_MAX_GUESSES,
  WORD_FIGHT_POINTS
} from "../../../../../shared/src/games/wordFightScoring.js";

const MAX_GUESSES = WORD_FIGHT_MAX_GUESSES;

function randomWord() {
  const index = Math.floor(Math.random() * WORD_FIGHT_SECRET_WORDS.length);
  return WORD_FIGHT_SECRET_WORDS[index];
}

function pickSecretWords(playerOrder) {
  if (playerOrder.length < 2) return {};
  const first = randomWord();
  let second = randomWord();
  if (WORD_FIGHT_SECRET_WORDS.length > 1) {
    while (second === first) {
      second = randomWord();
    }
  }
  return {
    [playerOrder[0]]: first,
    [playerOrder[1]]: second
  };
}

function normalizeGuess(rawGuess) {
  return String(rawGuess || "")
    .trim()
    .toUpperCase();
}

function buildFeedback(secret, guess) {
  const feedback = Array(guess.length).fill("absent");
  const secretChars = secret.split("");
  const taken = Array(secretChars.length).fill(false);

  for (let index = 0; index < guess.length; index += 1) {
    if (guess[index] !== secretChars[index]) continue;
    feedback[index] = "exact";
    taken[index] = true;
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (feedback[index] !== "absent") continue;
    const char = guess[index];
    const presentIndex = secretChars.findIndex((candidate, secretIndex) => candidate === char && !taken[secretIndex]);
    if (presentIndex === -1) continue;
    feedback[index] = "present";
    taken[presentIndex] = true;
  }

  return feedback;
}

function countLabel(feedback, label) {
  return feedback.reduce((total, value) => (value === label ? total + 1 : total), 0);
}

function getOtherPlayerId(state, playerId) {
  return state.playerOrder.find((entry) => entry !== playerId) || null;
}

function isPlayerComplete(state, playerId) {
  const progress = state.progressByPlayer[playerId];
  return Boolean(progress?.solved || progress?.exhausted);
}

function hasFinished(state) {
  return state.playerOrder.every((playerId) => isPlayerComplete(state, playerId));
}

function nextTurnPlayerId(state, playerId) {
  const other = getOtherPlayerId(state, playerId);
  if (other && !isPlayerComplete(state, other)) return other;
  if (!isPlayerComplete(state, playerId)) return playerId;
  return null;
}

function scoreTuple(state, playerId) {
  const progress = state.progressByPlayer[playerId];
  return [
    Number(progress?.score || 0)
  ];
}

function compareTuples(a, b) {
  const maxLen = Math.max(a.length, b.length);
  for (let index = 0; index < maxLen; index += 1) {
    const left = Number(a[index] || 0);
    const right = Number(b[index] || 0);
    if (left === right) continue;
    return left > right ? 1 : -1;
  }
  return 0;
}

function resolveWinner(state) {
  const [p1, p2] = state.playerOrder;
  if (!p1 || !p2) {
    return { winnerId: null, draw: true };
  }

  const score1 = scoreTuple(state, p1);
  const score2 = scoreTuple(state, p2);
  const comparison = compareTuples(score1, score2);
  if (comparison === 0) {
    return { winnerId: null, draw: true };
  }

  return {
    winnerId: comparison > 0 ? p1 : p2,
    draw: false
  };
}

function pointsForAttempt(values, attemptIndex) {
  if (!Array.isArray(values)) return 0;
  const value = Number(values[attemptIndex] || 0);
  return Number.isFinite(value) ? value : 0;
}

export function createWordFightEngine() {
  return {
    init(players) {
      const [p1, p2] = players;
      const playerOrder = [p1?.id, p2?.id].filter(Boolean);
      const wordsByPlayer = pickSecretWords(playerOrder);

      return {
        playerOrder,
        maxGuesses: MAX_GUESSES,
        nextPlayerId: playerOrder[0] || null,
        winnerId: null,
        draw: false,
        wordsByPlayer,
        boardsByPlayer: Object.fromEntries(playerOrder.map((id) => [id, []])),
        progressByPlayer: Object.fromEntries(
          playerOrder.map((id) => [id, {
            solved: false,
            exhausted: false,
            attemptsUsed: 0,
            solveAttempt: null,
            score: 0,
            scoreBreakdown: {
              presentPoints: 0,
              exactPoints: 0,
              solvePoints: 0
            },
            totalExact: 0,
            totalPresent: 0
          }])
        ),
        history: []
      };
    },

    applyMove(state, move, playerId) {
      if (state.winnerId || state.draw) {
        return { error: "Game is already finished." };
      }

      if (!state.playerOrder.includes(playerId)) {
        return { error: "Unknown player." };
      }

      if (playerId !== state.nextPlayerId) {
        return { error: "Not your turn." };
      }

      const progress = state.progressByPlayer[playerId];
      if (progress.solved) {
        return { error: "You already solved your word." };
      }
      if (progress.exhausted) {
        return { error: "You are out of guesses." };
      }

      const guess = normalizeGuess(move?.guess);
      if (!/^[A-Z]{4}$/.test(guess)) {
        return { error: "Guess must be exactly 4 letters." };
      }
      if (!isWordFightWord(guess)) {
        return { error: "Guess must be a valid Word Fight word." };
      }

      const secret = String(state.wordsByPlayer[playerId] || "");
      if (!secret) {
        return { error: "Missing secret word." };
      }

      const feedback = buildFeedback(secret, guess);
      const exact = countLabel(feedback, "exact");
      const present = countLabel(feedback, "present");
      const attemptsUsed = progress.attemptsUsed + 1;
      const attemptIndex = attemptsUsed - 1;
      const solved = guess === secret;
      const exhausted = !solved && attemptsUsed >= state.maxGuesses;
      const presentPointsThisGuess = present * pointsForAttempt(WORD_FIGHT_POINTS.presentByAttempt, attemptIndex);
      const exactPointsThisGuess = exact * pointsForAttempt(WORD_FIGHT_POINTS.exactByAttempt, attemptIndex);
      const solvePointsThisGuess = solved ? pointsForAttempt(WORD_FIGHT_POINTS.solveByAttempt, attemptIndex) : 0;
      const pointsEarned = presentPointsThisGuess + exactPointsThisGuess + solvePointsThisGuess;
      const previousBreakdown = progress.scoreBreakdown && typeof progress.scoreBreakdown === "object"
        ? progress.scoreBreakdown
        : { presentPoints: 0, exactPoints: 0, solvePoints: 0 };

      const nextProgress = {
        ...progress,
        attemptsUsed,
        solved,
        exhausted,
        solveAttempt: solved ? attemptsUsed : progress.solveAttempt,
        score: Number(progress.score || 0) + pointsEarned,
        scoreBreakdown: {
          presentPoints: Number(previousBreakdown.presentPoints || 0) + presentPointsThisGuess,
          exactPoints: Number(previousBreakdown.exactPoints || 0) + exactPointsThisGuess,
          solvePoints: Number(previousBreakdown.solvePoints || 0) + solvePointsThisGuess
        },
        totalExact: progress.totalExact + exact,
        totalPresent: progress.totalPresent + present
      };

      const boardsByPlayer = {
        ...state.boardsByPlayer,
        [playerId]: [
          ...(state.boardsByPlayer[playerId] || []),
          {
            guess,
            feedback,
            exact,
            present,
            solved,
            pointsEarned,
            pointsByType: {
              present: presentPointsThisGuess,
              exact: exactPointsThisGuess,
              solve: solvePointsThisGuess
            }
          }
        ]
      };

      const progressByPlayer = {
        ...state.progressByPlayer,
        [playerId]: nextProgress
      };

      const baseNextState = {
        ...state,
        boardsByPlayer,
        progressByPlayer,
        history: [
          ...state.history,
          {
            playerId,
            guess,
            feedback,
            exact,
            present,
            solved,
            pointsEarned,
            pointsByType: {
              present: presentPointsThisGuess,
              exact: exactPointsThisGuess,
              solve: solvePointsThisGuess
            }
          }
        ]
      };

      if (hasFinished(baseNextState)) {
        const outcome = resolveWinner(baseNextState);
        return {
          state: {
            ...baseNextState,
            nextPlayerId: null,
            winnerId: outcome.winnerId,
            draw: outcome.draw
          }
        };
      }

      return {
        state: {
          ...baseNextState,
          nextPlayerId: nextTurnPlayerId(baseNextState, playerId)
        }
      };
    },

    getVisibleState(state, viewerPlayerId) {
      return {
        playerOrder: state.playerOrder,
        maxGuesses: state.maxGuesses,
        nextPlayerId: state.nextPlayerId,
        winnerId: state.winnerId,
        draw: state.draw,
        boardsByPlayer: state.boardsByPlayer,
        progressByPlayer: state.progressByPlayer,
        history: state.history,
        mySecretWord: viewerPlayerId ? state.wordsByPlayer?.[viewerPlayerId] || null : null
      };
    }
  };
}
