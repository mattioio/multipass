export function normalizeRoomCode(rawCode: string | null | undefined): string;

export function parseScreenRoute(
  hash: string | null | undefined,
  hashToScreen: Record<string, string>
): {
  screen: string | null;
  joinCode: string | null;
};
