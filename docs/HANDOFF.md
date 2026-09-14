# Handoff — next agent

**Read first:** [`docs/CONTEXT.md`](CONTEXT.md) (canonical). Then PRD → BACKLOG → STATUS → `build2/docs/journal/PROGRESS.md` + `BLOCKED.md`.

**As of:** 2026-09-14T18:05Z. Network `"84532"` only. Git `main` on https://github.com/shreyas-sovani/Moat.

## Closed last session

- **2.1 PASS** — graph I1–I6; KH Condition is `type: "action"` + `actionType: "Condition"`. Journal `build2/docs/journal/2.1/`.
- **2.2 PASS** — REST client 11 unit tests (retry, idempotency, chain guard, `KhUnsupportedError`, `workflowRows`). Journal `2.2/`.
- **2.3 PASS** — live smoke create/list/delete. Workflow `4nejcqnx21wsfxquxosk0`, key `moat:smoke:2026-09-14`. Rerun: same id, not in list (no duplicate). Journal `kh-smoke/`.
- **3.1 PASS** — Prisma migration `20260914180000_init` committed; seed script + test. Journal `3.1/`.

## Do not do

- Do not create another Morpho market or guess a market id.
- Do not wrap more ETH without `GET /api/analytics/spend-cap` (≈0.001 ETH native remaining).
- Do not use REST `/api/workflows/validate` (405). Local `validateGraphJson` then create.
- Do not copy skill-sample `"8453"`, `cron`, Condition `type: "condition"`, or `conditions[]`.
- Do not start Phase 4–7 or `bounty/` before 3.4/3.5.
- Do not commit `.env`. Do not reuse idempotency key `moat:smoke:2026-09-14` for a *new* workflow today.

## Your block (in order)

1. **Task 3.2** — viem reads of the **existing** market in `verified.json`; ABI selectors via `cast sig` into journal. `packages/risk/src/abi/morpho.ts` already has a view fragment — cross-check selectors, don't invent a market.
2. Then 3.3 watcher/supervisor (mocked KH) → 3.4 default plan → 3.5 drill (`withdrawCollateral` through KH, `simulate: true` first; do not wrap ETH).

After every gate: rewrite CONTEXT/STATUS/HANDOFF/PROGRESS/BLOCKED to **current** status. After the whole assigned block is PASS: delete prior-agent handoff/pickup files and any other doc that would mislead the next agent. Keep journals + `verified.json`. Stale docs are a defect.
