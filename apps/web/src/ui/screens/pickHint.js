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
    const localStarterId = room.round?.firstPlayerId || null;
    const localStarter = [room.players?.host, room.players?.guest]
      .filter(Boolean)
      .find((player) => player.id === localStarterId);
    if (!localStarter) {
      hint.textContent = "Pick a game. Player 1 starts the first round.";
      return;
    }
    hint.textContent = `Pick the next game. ${localStarter.name || "Player 1"} starts this round.`;
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

  if (resolved && room.round?.firstPlayerId) {
    const starter = room.round.firstPlayerId === room.players.host?.id
      ? room.players.host
      : room.players.guest;
    hint.textContent = `Game: ${getGameName(room, resolved)}. ${starter?.name || "Player 1"} starts.`;
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
