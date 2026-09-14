# Handoff — next agent

**Read first:** [`docs/CONTEXT.md`](CONTEXT.md) (canonical). Then PRD → BACKLOG → STATUS → `build2/docs/journal/PROGRESS.md` + `BLOCKED.md`.

**As of:** 2026-09-14T20:20Z. Network `"84532"` only. Git `main` on https://github.com/shreyas-sovani/Moat.

## Closed last session

- **3.4 PASS**. Default top-up plan armed on KeeperHub. Workflow `ojxu9lcwdmb6bxl0mh5qm` `enabled=true`. Guard `armed` linked to policy (trigger 110, `maxSpendUsd=31`) + plan. Idempotent: rerun → 1 guard. Evidence `build2/docs/journal/3.4/`. Command: `pnpm --filter @moat/worker arm:plan`. Morpho plugin 422 on 84532 — graph uses `web3/write-contract` `supplyCollateral` (0.001 WETH wei). Manual trigger. Do not delete this workflow.
- Prior: 0.1–0.6, 1.1–1.5, 2.1–2.3, 3.1–3.3. Latest CI green: [34891501112](https://github.com/shreyas-sovani/Moat/actions/runs/34891501112) (`5e0a131`).

## Do not do

- Do not create another Morpho market or guess a market id.
- Do not wrap more ETH without `GET /api/analytics/spend-cap` (≈0.001 ETH native remaining as of seed).
- Do not use REST `/api/workflows/validate` (405). Local `validateGraphJson` then create.
- Do not use `morpho/*` protocol actions on `"84532"` (live 422: networks `1|8453|11155111`). Use `web3/write-contract` / `directContractCall`.
- Do not copy skill-sample `"8453"`, `cron`, Condition `type: "condition"`, or `conditions[]`.
- Do not start Phase 4–7 or `bounty/` before 3.5.
- Do not commit `.env`. Do not reuse `moat:smoke:2026-09-14` or `moat:plan:ea95dcb2-2725-4e4d-a38d-b703c5df25fb` for a *new* workflow.
- Do not delete KH workflow `ojxu9lcwdmb6bxl0mh5qm`.
- Do not wipe `packages/db/prisma/dev.db` (gitignored) without restoring Guard from `journal/3.4/`.
- Do not invert `breachDetected` (`ratio <= trigger`). Live ~70.5 with trigger 110 **would fire as soon as the watcher ticks**.
- Do not start a live watcher until 3.5 accounts for that fire + WETH buffer = 0 (true-branch needs `>= 1e15` wei WETH).

## Your block (in order)

1. **Task 3.5** — drill milestone. `withdrawCollateral` through KH (`simulate: true` first, then broadcast with a new idempotency key). Then watcher → `executeWorkflow(ojxu9lcwdmb6bxl0mh5qm)` → tx hashes in `journal/run1/`. Gate: ≥2 explorer-resolving hashes, Run succeeded + reconciledAt, after ratio < before by ≥15 pct-points.

After every gate: rewrite CONTEXT/STATUS/HANDOFF/PROGRESS/BLOCKED to **current** status. After the whole assigned block is PASS: delete prior-agent handoff/pickup files. Keep journals + `verified.json`. Stale docs are a defect.
