# React Runtime Refactor Notes

## Baseline build metrics (captured on 2026-03-05)

From `npm --prefix apps/web run build`:

- `dist/assets/runtime-BvnTmV7e.js`: `126.55 kB` (`38.72 kB` gzip)
- `dist/assets/index-BhYSLWz0.js`: `242.46 kB` (`77.71 kB` gzip)
- `dist/assets/index-D1C24Uzi.css`: `129.56 kB` (`26.42 kB` gzip)

## Post-refactor build metrics (captured on 2026-03-05)

From `npm --prefix apps/web run build` after React runtime migration:

- `dist/assets/index-Cus8YHt9.js`: `308.78 kB` (`100.32 kB` gzip) - default React runtime path.
- `dist/assets/runtime--Ku7x4KA.js`: `115.79 kB` (`34.75 kB` gzip) - legacy fallback chunk (lazy-loaded only when runtime mode is `legacy`).
- `dist/assets/index-D1C24Uzi.css`: `129.56 kB` (`26.42 kB` gzip)

Default-path JS gzip delta vs baseline combined entry gzip (`38.72 + 77.71 = 116.43 kB`):

- React default path now serves `100.32 kB` gzip upfront.
- Legacy fallback remains available behind the runtime kill switch and is not part of the default boot path.

## Guardrails for this migration branch

- No server message schema changes.
- No server protocol contract shape changes.
- Runtime mode defaults to React path unless explicitly overridden by:
  - `localStorage["multipass_runtime_mode"]`, or
  - `VITE_RUNTIME_MODE`.

## Transitional runtime behavior

- React runtime is the default production boot path.
- Legacy runtime remains available behind `multipass_runtime_mode=legacy` for one release as a rollback guard.
- Smoke tests explicitly boot web with `VITE_RUNTIME_MODE=react`; legacy remains fallback-only.
