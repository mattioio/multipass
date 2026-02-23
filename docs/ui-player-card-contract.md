# UI Player Card Contract

## Purpose

Use one player-card primitive for picker, lobby scoreboard, and winner scoreboard to prevent visual drift.

## Source Of Truth

- Markup/class mapping: `/Users/matthew/Projects/multipass/apps/web/src/ui/shared/playerCardContract.js`
- React shell: `/Users/matthew/Projects/multipass/apps/web/src/ui/components/PlayerCardShell.tsx`
- Runtime DOM builder: `/Users/matthew/Projects/multipass/apps/web/src/ui/shared/playerCardDom.js`
- Styles: `/Users/matthew/Projects/multipass/apps/web/src/styles/components.css`

## Rules

1. Do not hand-build player card frame markup in runtime or components.
2. Use `PlayerCardShell` in React code.
3. Use `createPlayerCardElement(...)` in legacy runtime code.
4. Use class names from `getPlayerCardClassNames(...)` only.
5. Do not reintroduce legacy `score-emoji*` selectors.
6. Shared player-card text styles must own typography (including `font-weight`) and must not inherit weight from parent host elements (`button`, `span`, etc.).
7. Any context that mirrors player art for Player 2 must also mirror the lower-third badge side/corner treatment in that same context.

## Variants

- `picker`: local/host/join avatar tiles.
- `score`: lobby and winner score columns.
- `compact`: reserved for future condensed card contexts.
