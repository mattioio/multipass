# Multipass Ops Runbook

## Endpoint policy
- Canonical primary WebSocket endpoint: `wss://api.loreandorder.com`
- Backup failover endpoints: `wss://multipass-api.onrender.com`, `wss://multipass-server.onrender.com`
- Client failover order follows `VITE_WS_URL` left-to-right.

## Health probes
- Liveness: `GET /healthz`
  - Expected: `200` with `{ "status": "ok", "timestamp": <number> }`
- Readiness: `GET /readyz`
  - Expected: `200` with `{ "status": "ready", "checks": { "gameRegistry": "ok" } }`
  - Non-ready: `503`

## Incident triage checklist
1. Confirm primary endpoint reachability:
   - Browser console: `new WebSocket("wss://api.loreandorder.com")`
2. Check readiness:
   - `curl -sS https://api.loreandorder.com/readyz`
3. Check liveness:
   - `curl -sS https://api.loreandorder.com/healthz`
4. Review structured server logs for:
   - `ws.origin_rejected`
   - `ws.rate_limited`
   - `ws.message_too_large`
   - `ws.socket_error`
5. If primary is degraded, verify that backups are reachable and serving compatible protocol.
6. If clients still fail, verify `VITE_WS_URL` in latest deploy artifact and clear browser local override:
   - `localStorage.removeItem("multipass_ws_url")`

## Rate limiting
- Controlled by:
  - `WS_RATE_LIMIT_WINDOW_MS`
  - `WS_RATE_LIMIT_MAX_REQUESTS`
- Applied to high-risk actions: `create_room`, `join_room`, `validate_room`, `move`.

## Origin policy
- Controlled by `WS_ALLOWED_ORIGINS` (comma-separated).
- If unset/empty, all origins are allowed.
- If set, non-listed origins are rejected with WS close code `1008` and typed error payload.

## Message size guardrail
- Controlled by `WS_MAX_PAYLOAD_BYTES`.
- Oversized messages are rejected and connection is closed with code `1009`.
