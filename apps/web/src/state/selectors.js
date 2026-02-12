export function getRoomPlayers(room) {
  if (!room) return [];
  return [room.players?.host, room.players?.guest].filter(Boolean);
}

export function isRoundFinished(room) {
  if (!room?.game?.state) return false;
  return Boolean(room.game.state.winnerId || room.game.state.draw);
}

export function isActiveGame(room) {
  if (!room?.game?.state) return false;
  return !isRoundFinished(room);
}

export function isPlayerRole(role) {
  return role === "host" || role === "guest";
}

export function getLeaderId(players) {
  const list = (players || []).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0].id;

  const [a, b] = list;
  const winsA = a.gamesWon ?? 0;
  const winsB = b.gamesWon ?? 0;
  if (winsA > winsB) return a.id;
  if (winsB > winsA) return b.id;
  return null;
}
