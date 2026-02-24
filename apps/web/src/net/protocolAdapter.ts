import type {
  ErrorMessage,
  JoinRoomMessage,
  RoomPreviewMessage,
  RoomStateMessage,
  SessionMessage,
  ValidateRoomMessage
} from "../types/protocol";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export type ParsedServerMessage =
  | { kind: "session"; message: SessionMessage }
  | { kind: "room_state"; message: RoomStateMessage }
  | { kind: "room_preview"; message: RoomPreviewMessage }
  | { kind: "error"; message: ErrorMessage }
  | { kind: "unknown"; message: UnknownRecord };

export function parseServerMessage(raw: unknown): ParsedServerMessage {
  if (!isObject(raw)) return { kind: "unknown", message: {} };
  const type = asString(raw.type);

  if (type === "session" && typeof raw.clientId === "string") {
    return { kind: "session", message: raw as unknown as SessionMessage };
  }

  if (type === "room_state" && isObject(raw.room) && isObject(raw.you)) {
    return { kind: "room_state", message: raw as unknown as RoomStateMessage };
  }

  if (type === "room_preview" && isObject(raw.room)) {
    return { kind: "room_preview", message: raw as unknown as RoomPreviewMessage };
  }

  if (type === "error" && typeof raw.message === "string") {
    return { kind: "error", message: raw as unknown as ErrorMessage };
  }

  return { kind: "unknown", message: raw };
}

export function buildValidateRoomMessage(input: {
  code: string;
  clientId?: string | null;
  seatToken?: string | null;
}): ValidateRoomMessage {
  return {
    type: "validate_room",
    code: input.code,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.seatToken ? { seatToken: input.seatToken } : {})
  };
}

export function buildJoinRoomMessage(input: {
  code: string;
  clientId?: string | null;
  seatToken?: string | null;
  avatar?: string | null;
  honorific?: "mr" | "mrs" | null;
}): JoinRoomMessage {
  return {
    type: "join_room",
    code: input.code,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.seatToken ? { seatToken: input.seatToken } : {}),
    ...(input.avatar ? { avatar: input.avatar } : {}),
    ...(input.honorific ? { honorific: input.honorific } : {})
  };
}

export function isRoomNotFoundError(message: ErrorMessage): boolean {
  return message.code === "ROOM_NOT_FOUND" || message.message === "Room not found.";
}

export function isRoomFullError(message: ErrorMessage): boolean {
  return message.code === "ROOM_FULL" || message.message === "Room is full.";
}

export function isAvatarRequiredError(message: ErrorMessage): boolean {
  return message.code === "AVATAR_REQUIRED" || message.message === "Pick an avatar.";
}

export function getJoinCodeErrorStatusMessage(message: ErrorMessage): string {
  if (isRoomNotFoundError(message)) return "Room not found";
  if (isRoomFullError(message)) return "Room is full";
  return "Couldn't verify room";
}
