# Handoff — next agent

**Read first:** [`docs/CONTEXT.md`](CONTEXT.md) (canonical). Then PRD → BACKLOG → STATUS → `build2/docs/journal/PROGRESS.md` + `BLOCKED.md`.

**As of:** 2026-09-14T17:50Z. Network `"84532"` only. Git `main` on https://github.com/shreyas-sovani/Moat.

## Closed last session

- T1 Morpho WETH/USDC market + seed via KeeperHub (Gate 0.5).
- Telegram screenshot (Gate 0.6). Adversary = same guardian.
- Pushed `main`; CI run 34875987566 green (Gate 0.2).
- Docs rewritten so pickup does not depend on chat: `CONTEXT.md`, root `README.md`, `AGENTS.md`.

## Do not do

- Do not create another Morpho market or guess a market id.
- Do not wrap more ETH without `GET /api/analytics/spend-cap` (≈0.001 ETH native remaining).
- Do not use REST `/api/workflows/validate` (405).
- Do not copy skill-sample `"8453"`, `cron`, or Condition `conditions[]`.
- Do not start Phase 4–7 or `bounty/` before 2.3 is PASS.
- Do not commit `.env`.

## Your block (in order)

1. **Task 2.1** — journal the existing graph tests (`build2/docs/journal/2.1/`). Fill any missing AC. Update CONTEXT/STATUS/PROGRESS.
2. **Task 2.2** — add unit tests until ≥8; journal `2.2/`.
3. **Task 2.3** — fix smoke (local `validateGraphJson`, real telegram integration, list shape), run `pnpm --filter @moat/kh smoke` twice, journal `kh-smoke/`.
4. If 2.3 PASS: **Task 3.1** Prisma migrations committed.

After every gate: rewrite CONTEXT/STATUS/HANDOFF/PROGRESS/BLOCKED to **current** status. After the whole assigned block is PASS: delete prior-agent handoff/pickup files and any other doc that would mislead the next agent. Keep journals + `verified.json`. Stale docs are a defect.
