# Backend Architecture

## Overview
The backend runs a Node HTTP + WebSocket service with in-memory room state.

## Module boundaries
- `/Users/matthew/Projects/multipass/apps/server/src/bootstrap/server.js`
  - Runtime assembly: config, logger, HTTP server, WS server, pruning loop.
- `/Users/matthew/Projects/multipass/apps/server/src/http/routes.js`
  - HTTP routing for static assets and health endpoints.
- `/Users/matthew/Projects/multipass/apps/server/src/ws/handler.js`
  - WebSocket connection lifecycle, origin checks, payload limits, rate limiting, message dispatch.
- `/Users/matthew/Projects/multipass/apps/server/src/domain/rooms/service.js`
  - Core room/session/game flow domain logic.
- `/Users/matthew/Projects/multipass/apps/server/src/domain/rooms/store.js`
  - In-memory room store abstraction.
- `/Users/matthew/Projects/multipass/apps/server/src/domain/games/service.js`
  - Game registry adapter around static game catalog.
- `/Users/matthew/Projects/multipass/apps/server/src/protocol/schema.js`
  - Message normalization, inbound validation, contract examples.
- `/Users/matthew/Projects/multipass/apps/server/src/protocol/errors.js`
  - Typed protocol error codes and default messages.
- `/Users/matthew/Projects/multipass/apps/server/src/infra/logger.js`
  - Structured JSON logging.

## Data flow
1. HTTP request enters `http/routes.js`.
2. Health/readiness are served directly; static files are served from web root.
3. WS frames enter `ws/handler.js`.
4. Frames are size-checked, parsed, normalized, and rate-limited.
5. Room/game mutations are delegated to `domain/rooms/service.js`.
6. Updated room state is broadcast as `room_state` to connected participants.

## Compatibility model
- Existing message shapes remain valid.
- Additive protocol evolution is supported via optional fields.
- Error messages include `code` + legacy `message` for client compatibility.

## Operational controls
- `WS_ALLOWED_ORIGINS`: allowed origins list.
- `WS_MAX_PAYLOAD_BYTES`: max WS payload.
- `WS_RATE_LIMIT_WINDOW_MS`: limiter window.
- `WS_RATE_LIMIT_MAX_REQUESTS`: limiter threshold.
- `ROOM_TTL_MS`: room expiry threshold.
