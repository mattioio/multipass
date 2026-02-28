# multipass

Multiplayer, turn-based mini-games for two players (with future spectator support).

## Environment requirements
- Node.js `20` (same version used in CI).
- npm (bundled with Node).

If you have `nvm` installed:
- `cd /Users/matthew/Projects/multipass`
- `nvm use`

## Local dev (first time)
1. Install server dependencies:
   - `cd /Users/matthew/Projects/multipass/apps/server`
   - `npm install`
2. Install web dependencies:
   - `cd /Users/matthew/Projects/multipass/apps/web`
   - `npm install`
3. Start both servers with one command:
   - `cd /Users/matthew/Projects/multipass/apps/server`
   - `npm run dev`
4. Open the app:
   - `http://localhost:3000`

`npm run dev` in `apps/server` now starts:
- API + WebSocket server on `http://localhost:3001`
- React/Vite frontend on `http://localhost:3000`

If you want to run only the API server, use:
- `npm run dev:api`

## Running smoke tests
- `cd /Users/matthew/Projects/multipass/apps/server`
- `npm run smoke`

Playwright will boot both required servers automatically.

## Baseline validation gate
Run this full suite before merging major backend/protocol work:
- `npm --prefix /Users/matthew/Projects/multipass/apps/web test`
- `npm --prefix /Users/matthew/Projects/multipass/apps/web run build`
- `npm --prefix /Users/matthew/Projects/multipass/apps/server run smoke:local`
- `npm --prefix /Users/matthew/Projects/multipass/apps/server run smoke:online`

## App icon source of truth
- Canonical icon artwork lives at `/Users/matthew/Projects/multipass/apps/web/src/assets/appicon.svg`.
- Generated outputs include favicon PNGs, `favicon.ico`, Apple touch icon, and manifest icons.
- Regenerate icons locally with:
  - `npm --prefix /Users/matthew/Projects/multipass/apps/web run icons:generate`
- GitHub Pages deploy workflow regenerates icons from `appicon.svg` before building.

## Production WebSocket endpoint
- GitHub Pages production builds inject a prioritized list in `VITE_WS_URL`.
- Canonical primary endpoint: `wss://api.loreandorder.com`.
- Current production list (priority order): `wss://api.loreandorder.com`.
- The app retries the next endpoint only if the current candidate fails.

## Smart invite links
- Host can use the in-room `Share` action to copy a deep-link invite.
- Canonical invite format is `/#join=CODE` (example: `https://your-site.example/#join=FVBJ`).
- Opening that URL sends players to Join, pre-fills the room code, and auto-validates it.
- If the room is unavailable, players stay in Join and get a clear message.

Quick check in browser DevTools console:
- `new WebSocket("wss://api.loreandorder.com")`
- Expected result: socket opens (no immediate close/error).

Temporary browser override (for debugging):
- `localStorage.setItem("multipass_ws_url", "wss://your-endpoint.example.com")`
- Multi-endpoint override is also supported:
- `localStorage.setItem("multipass_ws_url", "wss://primary.example.com,wss://backup.example.com")`
- Refresh the page after setting the override.
- To clear the override: `localStorage.removeItem("multipass_ws_url")`

## Project structure
- `apps/web`: React + TypeScript + Vite frontend
- `apps/server`: Node HTTP + WebSocket server, in-memory rooms

## Adding a new game (fast path)
1. Copy the template files in `/Users/matthew/Projects/multipass/apps/web/src/domain/games/template`.
2. Add your game definition in `/Users/matthew/Projects/multipass/apps/web/src/domain/games/catalog.js`.
3. Confirm your module appears in DevKit under `Game Modules`.
4. Add tests:
   - local engine unit tests
   - one integration/smoke assertion for pick -> game render
5. Run validation before merging:
   - `npm --prefix /Users/matthew/Projects/multipass/apps/web test`
   - `npm --prefix /Users/matthew/Projects/multipass/apps/web run build`
   - `npm --prefix /Users/matthew/Projects/multipass/apps/server run smoke`

## Notes
- Rooms expire after 90 minutes of inactivity.
- No accounts. Rejoin uses a device token stored locally.
- Tic Tac Toe is the first game; more games can be added under `apps/server/src/games`.

## Backend environment variables
- `WS_ALLOWED_ORIGINS`: comma-separated origin allowlist (empty means allow all).
- `WS_MAX_PAYLOAD_BYTES`: max WebSocket payload size in bytes.
- `WS_RATE_LIMIT_WINDOW_MS`: rate-limit window for high-risk actions.
- `WS_RATE_LIMIT_MAX_REQUESTS`: max allowed requests per window for high-risk actions.
- `ROOM_TTL_MS`: room expiry duration in milliseconds.

## Protocol docs generation
- WebSocket contract docs are generated from server protocol schema.
- Regenerate with:
  - `npm --prefix /Users/matthew/Projects/multipass/apps/server run contract:generate`
