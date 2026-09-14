# Moat build status — 2026-09-14T20:40Z

**Canonical pickup:** [`docs/CONTEXT.md`](CONTEXT.md) (read first). **Handoff:** [`HANDOFF.md`](HANDOFF.md).

**Product:** Moat — agent-guarded Morpho liquidation protection. **Testnet only.**  
**Code root:** `build2/`. **Bounty:** `bounty/` (not started).  
**Deadline:** 2026-09-18. **Network:** Base Sepolia `"84532"`.  
**Git:** `main` @ https://github.com/shreyas-sovani/Moat

## Done (gated PASS)

Phase **0.1–0.6**, Phase **1.1–1.5**, Phase **2.1–2.3**, Tasks **3.1**, **3.2**, **3.3**, **3.4**, **3.5**. Live Morpho position, Telegram screenshot, KH smoke, Prisma migrations, viem position sync, mocked watcher/supervisor, default top-up plan armed on KH (`ojxu9lcwdmb6bxl0mh5qm`), live drill+approve+save with explorer hashes in `journal/run1/`. **Latest CI green:** [34891501112](https://github.com/shreyas-sovani/Moat/actions/runs/34891501112) (`5e0a131` 3.4). Re-check CI after the 3.5 push. Prior: [34889924586](https://github.com/shreyas-sovani/Moat/actions/runs/34889924586) (3.3), [34889107110](https://github.com/shreyas-sovani/Moat/actions/runs/34889107110) (3.2). P1012-fix: [34879998395](https://github.com/shreyas-sovani/Moat/actions/runs/34879998395). Failed P1012 [34878616724](https://github.com/shreyas-sovani/Moat/actions/runs/34878616724) is closed.

## Not started

| Area | Notes |
|---|---|
| **4.1** recipes + context packet | Next. Pure `packages/agent`. No LLM. Env composer is **Gemini Flash**, not Anthropic Opus |
| 4.2–4.4 composer/critic/arm | After 4.1. Gemini Flash / Flash-Lite |
| 5.x UI S2–S8 | Landing S1 only. No shadcn yet (Task 5.1) |
| 6.x fallback/breaker | |
| 7.x video/submit | Root README exists; demo video and DoraHacks form not done. KH Telegram integration still missing a bot token |
| bounty/ | Do not mix |

## Live position (do not recreate)

See CONTEXT.md §5. Market `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d`. Guardian = adversary `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`. Collateral restored to `19000000000000000` after 3.5. After-save ratio **~68.61% of LLTV** (seed was ~70.53). Policy **armed** trigger 110 — watcher would still fire immediately. WETH buffer 0. Drill `0x5e57df2e…7ab9b`, save `0x821dbaef…1b8a`. Run `cmu1p9tie0001y3ax9706dnv7`.

## Next

**Task 4.1** recipe enumerator + context packet. Rewrite live docs to current status after the block; delete leftover handoff/pickup files.

## Bite list (short)

KH native cap 0.019 / 0.02 ETH used (`journal/run1/spend-cap.json`) · REST validate 405 · Python urllib 1010 · `.next/types` `any` · Gemini not Opus · skill samples use `"8453"` / `cron` / `type: "condition"` · SQLite `DATABASE_URL=file:./dev.db` · Prisma CLI via `pnpm --filter @moat/db prisma:migrate:*` · `Position.collateralShares` is Blue collateral **assets** · `breachDetected` is `ratio <= trigger` (live ~68.6 still fires at trigger 110) · Morpho plugin **no 84532** · default plan `ojxu9lcwdmb6bxl0mh5qm` Manual + `web3/write-contract` · `executeWorkflow` Idempotency-Key **header only** · after withdraw, WETH `approve` to Blue before `supplyCollateral` · `index.ts` idle · do not wipe gitignored `dev.db` · `pnpm --filter @moat/worker arm:plan` / `drill` are idempotent/resumable · KH Telegram plugin needs a bot token on the org integration (B-012).
