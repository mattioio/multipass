export type Honorific = "mr" | "mrs";

export interface CreateRoomMessage {
  type: "create_room";
  avatar?: string;
  honorific?: Honorific;
  clientId?: string;
}

export interface JoinRoomMessage {
  type: "join_room";
  code: string;
  avatar?: string;
  honorific?: Honorific;
  clientId?: string;
  seatToken?: string;
}

export interface ValidateRoomMessage {
  type: "validate_room";
  code: string;
  clientId?: string;
  seatToken?: string;
}

export interface SelectGameMessage {
  type: "select_game";
  gameId: string;
}

export interface MoveMessage {
  type: "move";
  gameId?: string;
  move: Record<string, unknown>;
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | ValidateRoomMessage
  | SelectGameMessage
  | MoveMessage
  | { type: "leave_room" }
  | { type: "new_round" }
  | { type: "end_game_request" }
  | { type: "end_game_agree" }
  | { type: "ready_up" }
  | { type: "start_round" };

export interface SessionMessage {
  type: "session";
  clientId: string;
  seatToken?: string | null;
}

export interface ErrorMessage {
  type: "error";
  code?: string;
  message: string;
}

export interface RoomPreviewMessage {
  type: "room_preview";
  room: Record<string, unknown>;
}

export interface RoomStateMessage {
  type: "room_state";
  room: Record<string, unknown>;
  you: {
    clientId: string;
    playerId: string | null;
    role: string | null;
    roomCode: string | null;
  };
}

export type ServerMessage = SessionMessage | ErrorMessage | RoomPreviewMessage | RoomStateMessage;
