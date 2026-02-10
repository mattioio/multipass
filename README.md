# multipass

Multiplayer, turn-based mini-games for two players (with future spectator support).

## Local dev (first time)
1. Install server dependencies:
   - cd apps/server
   - npm install
2. Start the dev server:
   - npm run dev
3. Open the app:
   - http://localhost:3000

## Project structure
- apps/web: static frontend
- apps/server: Node HTTP + WebSocket server, in-memory rooms

## Notes
- Rooms expire after 90 minutes of inactivity.
- No accounts. Rejoin uses a device token stored locally.
- Tic Tac Toe is the first game; more games can be added under apps/server/src/games.
