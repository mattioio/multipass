const CLIENT_ID_KEY = "multipass_client_id";
const SEAT_TOKEN_KEY = "multipass_seat_token";
const LAST_ROOM_CODE_KEY = "multipass_last_room";
const LAST_ROOM_STARTED_AT_KEY = "multipass_last_room_started_at";

function readStorage(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | null, key: string, value: string | null): void {
  if (!storage) return;
  try {
    if (value === null) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, value);
  } catch {
    // Ignore persistence failures (private mode / storage restrictions).
  }
}

export interface RuntimePersistenceSnapshot {
  clientId: string | null;
  seatToken: string | null;
  lastRoomCode: string | null;
  lastRoomStartedAt: number | null;
}

export function loadRuntimePersistence(storage: Storage | null = null): RuntimePersistenceSnapshot {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  const rawStartedAt = readStorage(target, LAST_ROOM_STARTED_AT_KEY);
  const startedAt = rawStartedAt ? Number(rawStartedAt) : null;

  return {
    clientId: readStorage(target, CLIENT_ID_KEY),
    seatToken: readStorage(target, SEAT_TOKEN_KEY),
    lastRoomCode: readStorage(target, LAST_ROOM_CODE_KEY),
    lastRoomStartedAt: Number.isFinite(startedAt) ? startedAt : null
  };
}

export function persistClientSession(
  input: { clientId?: string | null; seatToken?: string | null },
  storage: Storage | null = null
): void {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (input.clientId !== undefined) {
    writeStorage(target, CLIENT_ID_KEY, input.clientId || null);
  }
  if (input.seatToken !== undefined) {
    writeStorage(target, SEAT_TOKEN_KEY, input.seatToken || null);
  }
}

export function persistLastRoom(
  input: { code?: string | null; startedAt?: number | null },
  storage: Storage | null = null
): void {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (input.code !== undefined) {
    writeStorage(target, LAST_ROOM_CODE_KEY, input.code || null);
  }
  if (input.startedAt !== undefined) {
    const value = typeof input.startedAt === "number" ? String(input.startedAt) : null;
    writeStorage(target, LAST_ROOM_STARTED_AT_KEY, value);
  }
}
