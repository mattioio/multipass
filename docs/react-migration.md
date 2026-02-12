# React Migration Map (Strangler Plan)

Goal: migrate UI incrementally with zero protocol changes and green smoke tests at every step.

## Guardrails
- Keep `/Users/matthew/Projects/multipass/apps/server/src/index.js` as source of truth.
- Keep WebSocket payload shape unchanged during migration.
- Keep `/Users/matthew/Projects/multipass/apps/web/src/contracts/roomState.js` as the contract reference.
- No screen is considered done until smoke tests pass.

## Migration Order

1. Landing + header shell
- Migrate hero/header + landing cards first.
- Keep room websocket + flow in vanilla module.
- Parity checks: settings open/close, mode toggle persistence, host/join buttons.

2. Local setup + picker
- Port local step flow (`p1`/`p2`) into React screen component.
- Keep existing state/event model unchanged behind adapter.
- Parity checks: auto-advance, player-1 locked tile, back behavior.

3. Lobby + game library
- Port scoreboard/lobby/pick library visuals.
- Keep current message dispatch for `select_game`.
- Parity checks: local pick path and online host/guest pick path.

4. Shuffle + game screen
- Port wheel/shuffle and active game board.
- Preserve first-round shuffle and subsequent alternation behavior.
- Parity checks: local shuffle CTA, online server-driven shuffle reveal, turn indicator.

5. Winner + settings modal
- Port winner panel and settings modal.
- Parity checks: replay/home behavior, modal close interactions, theme persistence.

## Bridge Strategy
- Keep `/Users/matthew/Projects/multipass/apps/web/src/net/wsClient.js` as transport adapter.
- Keep `/Users/matthew/Projects/multipass/apps/web/src/state/*` as central event/state shape.
- During migration, React components subscribe to the same store first; reducer/protocol remain stable.

## Definition of Done Per Screen
- Visual parity with current behavior.
- Keyboard/focus behavior preserved.
- No protocol changes required.
- Smoke tests pass locally and in CI.
