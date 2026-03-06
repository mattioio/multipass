import type { RoomState } from "../types";

export function assertRoomShape(room: unknown): room is RoomState;
