/**
 * Renders hint text on the game picker screen.
 * @param {Object} options
 * @param {Object} options.room
 * @param {Object} options.state
 * @param {() => boolean} options.isLocalMode
 * @param {(room: any, gameId: string|null|undefined) => string|null} options.getGameName
 */
export function renderPickHint({ room, state, isLocalMode, getGameName }) {
  const hint = document.getElementById("pick-hint");
  if (!hint) return;

  if (isLocalMode()) {
    if (room.round?.status === "shuffling") {
      hint.textContent = "Game chosen. Spin to decide who starts.";
      return;
    }
    if (state.localHasSpun) {
      hint.textContent = "Pick the next game.";
      return;
    }
    hint.textContent = "Pick a game, then spin for first turn.";
    return;
  }

  if (!room.players.host || !room.players.guest) {
    hint.textContent = "Waiting for both players to join.";
    return;
  }

  const hostChoice = room.round?.hostGameId;
  const guestChoice = room.round?.guestGameId;
  const resolved = room.round?.resolvedGameId;
  const hostName = room.players.host?.name || "Host";
  const guestName = room.players.guest?.name || "Guest";

  if (room.round?.status === "shuffling") {
    hint.textContent = `Game: ${getGameName(room, resolved)}. Choosing who starts...`;
    return;
  }

  if (!hostChoice || !guestChoice) {
    const mine = state.you?.role === "host" ? hostChoice : guestChoice;
    const theirs = state.you?.role === "host" ? guestChoice : hostChoice;
    if (mine && !theirs) {
      hint.textContent = `You chose ${getGameName(room, mine)}. Waiting for teammate's choice.`;
      return;
    }
    if (!mine && theirs) {
      hint.textContent = `Teammate chose ${getGameName(room, theirs)}. Pick your game.`;
      return;
    }
    hint.textContent = "Both players choose a game. Host decides on mismatch.";
    return;
  }

  if (hostChoice === guestChoice) {
    hint.textContent = `Matched on ${getGameName(room, resolved)}.`;
    return;
  }

  hint.textContent = `${hostName}: ${getGameName(room, hostChoice)} | ${guestName}: ${getGameName(room, guestChoice)}. Host choice wins.`;
}
