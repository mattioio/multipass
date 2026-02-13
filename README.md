# multipass

Multiplayer, turn-based mini-games for two players (with future spectator support).

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

## Production WebSocket endpoint
- GitHub Pages production builds inject `VITE_WS_URL=wss://api.loreandorder.com`.
- The app connects to that endpoint for online room features (host/join/rejoin).

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
