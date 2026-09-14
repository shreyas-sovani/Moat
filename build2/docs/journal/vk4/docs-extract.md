# V-K2 docs extract (2026-09-14)

Fetched https://docs.keeperhub.com/api, /api/workflows, /api/executions, /api/direct-execution.

Base URL: `https://app.keeperhub.com` (paths already include `/api`; do not double).

| Operation | Documented path | Live probe |
|---|---|---|
| create workflow | `POST /api/workflows/create` | not posted (would mutate); listed in docs |
| validate workflow | not on REST | `POST /api/workflows/validate` → **405**; `mcpOnly` |
| execute workflow | `POST /api/workflows/{workflowId}/execute` | not posted (would mutate) |
| get execution / status | `GET /api/workflows/executions/{executionId}/status` | placeholder id → **404** (route exists) |
| execution logs | `GET /api/workflows/executions/{executionId}/logs` | placeholder id → **404** |
| wait execution | `GET /api/workflows/executions/{executionId}/wait` | documented; not probed with a hang |
| direct contract-call | `POST /api/execute/contract-call` | OPTIONS → **204** |
| direct transfer | `POST /api/execute/transfer` | HEAD → **405** (method not allowed; route exists) |
| direct execution status | `GET /api/execute/{executionId}/status` | placeholder → **404** |
| list workflows | `GET /api/workflows` | **200** |
| list chains | `GET /api/chains` | **200** |
| list schemas | `GET /api/mcp/schemas` | **200** |
| plugins catalog | `GET /api/plugins` | **404** — do not use |
| spend cap | `GET /api/analytics/spend-cap` | **200** (probed 2026-09-14 during T1; default 0.02 ETH)

Idempotency: send header `Idempotency-Key` on create/execute. `simulate` is JSON boolean.

Condition node `sourceHandle` must be `"true"` or `"false"`. Schedule field is `scheduleCron`.
