# Handoff — next agent

**Read first:** [`docs/CONTEXT.md`](CONTEXT.md) (canonical). Then PRD → BACKLOG → STATUS → `build2/docs/journal/PROGRESS.md` + `BLOCKED.md`.

**As of:** 2026-09-14T19:50Z. Network `"84532"` only. Git `main` on https://github.com/shreyas-sovani/Moat.

## Closed last session

- **3.2 PASS**. Viem reads of the existing WETH/USDC market; `Position` row matches Task 0.5 seed shares. Evidence: `build2/docs/journal/3.2/`. Live command: `pnpm --filter @moat/worker sync:positions`.
- Prior gates still PASS: 0.1–0.6, 1.1–1.5, 2.1–2.3, 3.1. CI last green: [34879998395](https://github.com/shreyas-sovani/Moat/actions/runs/34879998395).

## Do not do

- Do not create another Morpho market or guess a market id.
- Do not wrap more ETH without `GET /api/analytics/spend-cap` (≈0.001 ETH native remaining as of seed).
- Do not use REST `/api/workflows/validate` (405). Local `validateGraphJson` then create.
- Do not copy skill-sample `"8453"`, `cron`, Condition `type: "condition"`, or `conditions[]`.
- Do not start Phase 4–7 or `bounty/` before 3.4/3.5.
- Do not commit `.env`. Do not reuse idempotency key `moat:smoke:2026-09-14` for a *new* workflow.
- Do not run raw `prisma migrate deploy` inside `packages/db` without `DATABASE_URL`.
- Do not treat `Position.collateralShares` as Morpho supply shares — it stores Blue `position.collateral` **assets**. Oracle-adjust before `computePositionRisk`.

## Your block (in order)

1. **Task 3.3** — watcher + execution supervisor. Mocked KeeperHub client: race (exactly one `Run` + one `executeWorkflow`), supervisor running→completed, 15-min timeout, failed → `needs_attention`, success re-arms. Use `syncPositions` from 3.2. No live KH writes in 3.3.
2. Then 3.4 default plan (`enabled: true` on KH) → 3.5 drill (`withdrawCollateral` through KH, `simulate: true` first; do not wrap ETH).

After every gate: rewrite CONTEXT/STATUS/HANDOFF/PROGRESS/BLOCKED to **current** status. After the whole assigned block is PASS: delete prior-agent handoff/pickup files and any other doc that would mislead the next agent. Keep journals + `verified.json`. Stale docs are a defect.
