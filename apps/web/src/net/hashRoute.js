const JOIN_HASH = "#join";
const LEGACY_LANDING_HASH = "#landing";

export function normalizeRoomCode(rawCode) {
  return String(rawCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
}

export function parseScreenRoute(hash, hashToScreen) {
  const normalizedHash = String(hash || "").trim();
  if (!normalizedHash) {
    return { screen: null, joinCode: null };
  }

  const [routeRaw, joinCodeRaw = ""] = normalizedHash.split("=", 2);
  const routeHash = routeRaw.toLowerCase();

  if (routeHash === JOIN_HASH) {
    const normalizedJoinCode = normalizeRoomCode(joinCodeRaw);
    return {
      screen: "join",
      joinCode: normalizedJoinCode.length === 4 ? normalizedJoinCode : null
    };
  }

  if (routeHash === LEGACY_LANDING_HASH) {
    return {
      screen: "landing",
      joinCode: null
    };
  }

  return {
    screen: hashToScreen[normalizedHash.toLowerCase()] || null,
    joinCode: null
  };
}
