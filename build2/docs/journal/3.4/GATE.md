# Gate 3.4 verdict

Evaluated 2026-09-14T20:20Z against `docs/BACKLOG.md` Task 3.4.

Hand-coded default top-up plan is live on KeeperHub. Local `validateGraphJson` then `createWorkflow(..., enabled: true)`. REST validate is still 405 (B-004). Idempotency `moat:plan:ea95dcb2-2725-4e4d-a38d-b703c5df25fb`. Workflow id `ojxu9lcwdmb6bxl0mh5qm`. Command: `pnpm --filter @moat/worker arm:plan`. Do **not** delete this workflow (3.5 needs it). `index.ts` still idle.

Live KH 422 on first attempt: `morpho/supply-collateral` networks are `1 | 8453 | 11155111` — **not** Base Sepolia `"84532"` — and `assets` must be `uint256`. Evidence: `kh-422-morpho-plugin.json`. Default plan therefore uses `web3/write-contract` → Morpho Blue `supplyCollateral` (same path as T1). Amount `1000000000000000` (0.001 WETH wei). Trigger is **Manual** so KH cron cannot fire independently of the Moat watcher.

| AC | Result | Evidence |
|---|---|---|
| AC1 script exit 0; KH workflow `enabled=true` | SAT | `summary.json` `ok: true`; `ac1-create.json` first create; `ac1-list-created.json` `"enabled": true` |
| AC2 Guard `armed` linked to policy + plan + workflow id | SAT | `ac2-guard.json` — status `armed`, `khWorkflowId=ojxu9lcwdmb6bxl0mh5qm`, policy trigger 110, `maxSpendUsd=31` (USDC wallet buffer) |
| AC3 rerun → exactly 1 guard row | SAT | `ac3-rerun.json` `guardCount: 1`, `secondCreated: false`, same guard id. Script rerun still `ok: true` |

Unit tests (mocked KH): `ac-tests.txt` — 3 passed (create/enable/link, idempotent rerun, re-enable via `updateWorkflow`).

Suite after this gate: **67** tests. Lint + build green locally. Sweeps empty on product source.

**Verdict: PASS**
