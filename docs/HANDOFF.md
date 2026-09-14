# Handoff — next agent

**Read first:** [`docs/CONTEXT.md`](CONTEXT.md) (canonical). Then PRD → BACKLOG → STATUS → `build2/docs/journal/PROGRESS.md` + `BLOCKED.md`.

**As of:** 2026-09-14T19:55Z. Network `"84532"` only. Git `main` on https://github.com/shreyas-sovani/Moat.

## Closed last session

- **3.3 PASS**. Watcher + supervisor, mocked KH. AC1–AC5 in `build2/docs/journal/3.3/`. `tickWatcher` / `superviseRun` in `apps/worker/src/guard-loop.ts`. No live KH writes. `index.ts` still idle.
- **3.2 PASS** (viem sync). Latest CI green before this push: [34889107110](https://github.com/shreyas-sovani/Moat/actions/runs/34889107110) (`9d844f2`).
- Prior: 0.1–0.6, 1.1–1.5, 2.1–2.3, 3.1.

## Do not do

- Do not create another Morpho market or guess a market id.
- Do not wrap more ETH without `GET /api/analytics/spend-cap` (≈0.001 ETH native remaining as of seed).
- Do not use REST `/api/workflows/validate` (405). Local `validateGraphJson` then create.
- Do not copy skill-sample `"8453"`, `cron`, Condition `type: "condition"`, or `conditions[]`.
- Do not start Phase 4–7 or `bounty/` before 3.4/3.5.
- Do not commit `.env`. Do not reuse `moat:smoke:2026-09-14` for a *new* workflow.
- Do not run raw `prisma migrate deploy` inside `packages/db` without `DATABASE_URL`.
- Do not treat `Position.collateralShares` as Morpho supply shares — Blue collateral **assets**. Oracle-adjust before `computePositionRisk`.
- Do not invert `breachDetected` (`ratio <= trigger`). Live ~70.5 with trigger 110 would fire.

## Your block (in order)

1. **Task 3.4** — hand-coded default plan, armed. Builder from 2.1 + `verified.json` market + guardian + Policy (trigger 110). Local `validateGraphJson` then KH create (`moat:plan:<uuid>`), `enabled: true`, `Guard` `armed`. Idempotent: rerun → still exactly 1 guard row.
2. Then 3.5 drill (`withdrawCollateral` through KH, `simulate: true` first; do not wrap ETH).

After every gate: rewrite CONTEXT/STATUS/HANDOFF/PROGRESS/BLOCKED to **current** status. After the whole assigned block is PASS: delete prior-agent handoff/pickup files. Keep journals + `verified.json`. Stale docs are a defect.
