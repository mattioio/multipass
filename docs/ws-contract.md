# Multipass WebSocket Contract

This document defines the current wire contract between `/Users/matthew/Projects/multipass/apps/server/src/index.js` and `/Users/matthew/Projects/multipass/apps/web/src/legacy/runtime.js`.

## Server -> Client

### `session`
```json
{
  "type": "session",
  "clientId": "client_xxx"
}
```

### `room_state`
```json
{
  "type": "room_state",
  "room": {
    "code": "ABCD",
    "createdAt": 1730000000000,
    "updatedAt": 1730000000100,
    "players": {
      "host": {
        "id": "player_x",
        "name": "Banana",
        "emoji": "🍌",
        "theme": "banana",
        "role": "host",
        "score": 0,
        "gamesWon": 0,
        "ready": false,
        "connected": true
      },
      "guest": null
    },
    "spectators": [],
    "round": {
      "pickerId": null,
      "firstPlayerId": null,
      "shuffleAt": null,
      "status": "waiting_game",
      "hostGameId": null,
      "guestGameId": null,
      "resolvedGameId": null,
      "hasPickedStarter": false
    },
    "endRequest": null,
    "game": null,
    "games": [
      {
        "id": "tic_tac_toe",
        "name": "Tic Tac Toe",
        "minPlayers": 2,
        "maxPlayers": 2,
        "comingSoon": false,
        "bannerKey": "tic_tac_toe"
      }
    ]
  },
  "you": {
    "clientId": "client_xxx",
    "playerId": "player_x",
    "role": "host",
    "roomCode": "ABCD"
  }
}
```

### `error`
```json
{
  "type": "error",
  "message": "Human readable message"
}
```

## Client -> Server

### `create_room`
```json
{ "type": "create_room", "fruit": "banana", "clientId": "optional" }
```

### `join_room`
```json
{ "type": "join_room", "code": "ABCD", "fruit": "kiwi", "clientId": "optional" }
```

### `leave_room`
```json
{ "type": "leave_room" }
```

### `select_game`
```json
{ "type": "select_game", "gameId": "tic_tac_toe" }
```

### `move`
```json
{ "type": "move", "gameId": "tic_tac_toe", "move": { "index": 0 } }
```

### `new_round`
```json
{ "type": "new_round" }
```

### `end_game_request`
```json
{ "type": "end_game_request" }
```

### `end_game_agree`
```json
{ "type": "end_game_agree" }
```

## Deprecated Messages

`ready_up` and `start_round` are intentionally not used by the client anymore.
The server currently responds with an error message explaining to use `select_game`.

## Frontend Runtime Validation

`/Users/matthew/Projects/multipass/apps/web/src/contracts/roomState.js` contains:
- JSDoc typedefs for `RoomState`, `RoundState`, `PlayerState`, `YouState`
- `assertRoomShape(room)` dev validator (non-fatal, warning-only)

This validator runs on incoming `room_state` before applying UI updates.
