# Handoff — next agent

**Read first:** [`docs/CONTEXT.md`](CONTEXT.md) (canonical). Then PRD → BACKLOG → STATUS → `build2/docs/journal/PROGRESS.md` + `BLOCKED.md`.

**As of:** 2026-09-14T20:43Z. Network `"84532"` only. Git `main` on https://github.com/shreyas-sovani/Moat.

## Closed last session

- **3.5 PASS** (milestone). Live adversary `withdrawCollateral` through KH `directContractCall` (`simulate: true` first), WETH `approve` to Morpho Blue, then `executeWorkflow(ojxu9lcwdmb6bxl0mh5qm)` `supplyCollateral`. Run `cmu1p9tie0001y3ax9706dnv7` `status=succeeded` + `reconciledAt`. Ratios **99.221493 → 68.614935**. Evidence `build2/docs/journal/run1/` + `journal/3.5/`. Command: `pnpm --filter @moat/worker drill`. Hashes: drill `0x5e57df2ef8ca9d58131e8a1151e987945f739afd86687570a8e1a87e6a77ab9b`, approve `0x527f16eefb13d6c0696bd5658f19abd7f6c3e6a10474ac7f43c4162600a6585a`, save `0x821dbaef2363b75734c5a3db3a45ebbb8cd3a45dc841d752a48b0521f55d1b8a`.
- Prior: 0.1–0.6, 1.1–1.5, 2.1–2.3, 3.1–3.4. Armed plan KH `ojxu9lcwdmb6bxl0mh5qm`. Latest CI green: [34894416894](https://github.com/shreyas-sovani/Moat/actions/runs/34894416894) (`5316359` 3.5). Prior 3.4: [34891501112](https://github.com/shreyas-sovani/Moat/actions/runs/34891501112) (`5e0a131`).

## Do not do

- Do not create another Morpho market or guess a market id.
- Do not wrap more ETH without `GET /api/analytics/spend-cap` (0.019 / 0.02 ETH native used as of `journal/run1/spend-cap.json`).
- Do not use REST `/api/workflows/validate` (405). Local `validateGraphJson` then create.
- Do not use `morpho/*` protocol actions on `"84532"` (live 422: networks `1|8453|11155111`). Use `web3/write-contract` / `directContractCall`.
- Do not put `idempotency_key` in the JSON body of `executeWorkflow`. Header `Idempotency-Key` only.
- Do not copy skill-sample `"8453"`, `cron`, Condition `type: "condition"`, or `conditions[]`.
- Do not skip to UI (5.x), video (7.x), or `bounty/` before 4.1.
- Do not commit `.env`. Do not reuse used `moat:*` idempotency keys for a *new* workflow or write (list in CONTEXT §5).
- Do not delete KH workflow `ojxu9lcwdmb6bxl0mh5qm`.
- Do not wipe `packages/db/prisma/dev.db` (gitignored) without restoring Guard from `journal/3.4/` + `journal/run1/`.
- Do not invert `breachDetected` (`ratio <= trigger`). Live after-save ~68.6 with trigger 110 **would fire as soon as the watcher ticks**.
- Do not start a live watcher process loop: WETH buffer is 0 again (true-branch needs `>= 1e15` wei WETH) and the position still counts as a breach.
- Do not hardcode Anthropic models. Composer env is **Gemini Flash**.

## Your block (in order)

1. **Task 4.1** — recipe enumerator + context packet. `packages/agent/src/recipes.ts` + `context.ts`. Pure, no LLM. Amounts must land projected ratio in `[trigger+19, trigger+21]`. Drop over-budget and disallowed kinds (do not clamp). Packet Zod-validated; schema rejects a packet missing `constants.chainId`. Commit a full JSON fixture.

After every gate: rewrite CONTEXT/STATUS/HANDOFF/PROGRESS/BLOCKED to **current** status. After the whole assigned block is PASS: delete prior-agent handoff/pickup files. Keep journals + `verified.json`. Stale docs are a defect.
