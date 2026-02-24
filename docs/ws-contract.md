# Multipass WebSocket Contract

This document is generated from `/Users/matthew/Projects/multipass/apps/server/src/protocol/schema.js`.
Do not edit it manually; regenerate with `npm --prefix /Users/matthew/Projects/multipass/apps/server run contract:generate`.

## Server -> Client

### `session`

```json
{
  "type": "session",
  "clientId": "client_xxx",
  "seatToken": "seat_xxx"
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
        "name": "Mr Yellow",
        "honorific": "mr",
        "theme": "yellow",
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
      },
      {
        "id": "dots_and_boxes",
        "name": "Dots & Boxes",
        "minPlayers": 2,
        "maxPlayers": 2,
        "comingSoon": false,
        "bannerKey": "dots_and_boxes"
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

### `room_preview`

```json
{
  "type": "room_preview",
  "room": {
    "code": "ABCD",
    "host": {
      "id": "player_x",
      "name": "Mr Yellow",
      "honorific": "mr",
      "theme": "yellow",
      "role": "host",
      "score": 0,
      "gamesWon": 0,
      "ready": false,
      "connected": true
    },
    "guest": null,
    "takenThemes": [
      "yellow"
    ],
    "canRejoin": false
  }
}
```

### `error`

```json
{
  "type": "error",
  "code": "ROOM_NOT_FOUND",
  "message": "Room not found."
}
```

## Client -> Server

### `create_room`

```json
{
  "type": "create_room",
  "avatar": "yellow",
  "honorific": "mr",
  "clientId": "optional"
}
```

### `join_room`

```json
{
  "type": "join_room",
  "code": "ABCD",
  "avatar": "green",
  "honorific": "mrs",
  "clientId": "optional",
  "seatToken": "optional"
}
```

### `validate_room`

```json
{
  "type": "validate_room",
  "code": "ABCD",
  "clientId": "optional",
  "seatToken": "optional"
}
```

### `leave_room`

```json
{
  "type": "leave_room"
}
```

### `select_game`

```json
{
  "type": "select_game",
  "gameId": "tic_tac_toe"
}
```

### `move_tic_tac_toe`

```json
{
  "type": "move",
  "gameId": "tic_tac_toe",
  "move": {
    "index": 0
  }
}
```

### `move_dots_and_boxes`

```json
{
  "type": "move",
  "gameId": "dots_and_boxes",
  "move": {
    "edgeIndex": 0
  }
}
```

### `new_round`

```json
{
  "type": "new_round"
}
```

### `end_game_request`

```json
{
  "type": "end_game_request"
}
```

### `end_game_agree`

```json
{
  "type": "end_game_agree"
}
```

## Deprecated Messages

`ready_up` and `start_round` are accepted for backward compatibility and return typed errors directing clients to `select_game`.

## Frontend Runtime Validation

`/Users/matthew/Projects/multipass/apps/web/src/contracts/roomState.js` contains room-shape validation for incoming `room_state` payloads.
