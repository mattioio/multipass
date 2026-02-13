# New Game Module Template

Use this folder as the copy-safe baseline for adding a new game quickly.

## Checklist
1. Copy `GameTemplateSurface.tsx` and `gameTemplateEngine.js` into a new game module folder.
2. Add the new game to `/Users/matthew/Projects/multipass/apps/web/src/domain/games/catalog.js`.
3. Verify the game appears in DevKit `Game Modules`.
4. Add unit tests for local engine behavior.
5. Add one integration/smoke assertion for pick -> game render path.
6. Run:
   - `npm --prefix /Users/matthew/Projects/multipass/apps/web test`
   - `npm --prefix /Users/matthew/Projects/multipass/apps/web run build`
   - `npm --prefix /Users/matthew/Projects/multipass/apps/server run smoke`
