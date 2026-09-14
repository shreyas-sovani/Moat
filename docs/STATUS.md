# Moat build status — 2026-09-14T20:20Z

**Canonical pickup:** [`docs/CONTEXT.md`](CONTEXT.md) (read first). **Handoff:** [`HANDOFF.md`](HANDOFF.md).

**Product:** Moat — agent-guarded Morpho liquidation protection. **Testnet only.**  
**Code root:** `build2/`. **Bounty:** `bounty/` (not started).  
**Deadline:** 2026-09-18. **Network:** Base Sepolia `"84532"`.  
**Git:** `main` @ https://github.com/shreyas-sovani/Moat

## Done (gated PASS)

Phase **0.1–0.6**, Phase **1.1–1.5**, Phase **2.1–2.3**, Tasks **3.1**, **3.2**, **3.3**, **3.4**. Live Morpho position, Telegram screenshot, KH smoke, Prisma migrations, viem position sync, mocked watcher/supervisor, default top-up plan armed on KH (`ojxu9lcwdmb6bxl0mh5qm`). **Latest CI green:** [34891501112](https://github.com/shreyas-sovani/Moat/actions/runs/34891501112) (`5e0a131` 3.4). Prior: [34889924586](https://github.com/shreyas-sovani/Moat/actions/runs/34889924586) (3.3), [34889107110](https://github.com/shreyas-sovani/Moat/actions/runs/34889107110) (3.2). P1012-fix: [34879998395](https://github.com/shreyas-sovani/Moat/actions/runs/34879998395). Failed P1012 [34878616724](https://github.com/shreyas-sovani/Moat/actions/runs/34878616724) is closed.

## Not started

| Area | Notes |
|---|---|
| **3.5** drill | Next. `withdrawCollateral` via `web3/write-contract` (Morpho plugin 422 on 84532), `simulate: true` first |
| 4.x composer/critic | Env is **Gemini Flash**, not Anthropic Opus |
| 5.x UI S2–S8 | Landing S1 only. No shadcn yet (Task 5.1) |
| 6.x fallback/breaker | |
| 7.x video/submit | Root README exists; demo video and DoraHacks form not done |
| bounty/ | Do not mix |

## Live position (do not recreate)

See CONTEXT.md §5. Market `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d`. Guardian = adversary `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`. Ratio ~70.5% of 91.5% LLTV. Last viem sync 2026-09-14T19:45:52Z: same shares as seed. Policy **armed** trigger 110 — watcher would fire immediately. WETH buffer 0.

## Next

**Task 3.5** drill through KeeperHub. Rewrite live docs to current status after the block; delete leftover handoff/pickup files.

## Bite list (short)

KH native cap ~0.001 ETH left (as of seed) · REST validate 405 · Python urllib 1010 · `.next/types` `any` · Gemini not Opus · skill samples use `"8453"` / `cron` / `type: "condition"` · SQLite `DATABASE_URL=file:./dev.db` · Prisma CLI via `pnpm --filter @moat/db prisma:migrate:*` · `Position.collateralShares` is Blue collateral **assets** · `breachDetected` is `ratio <= trigger` (live 70.5 would fire at trigger 110) · Morpho plugin **no 84532** · default plan `ojxu9lcwdmb6bxl0mh5qm` Manual + `web3/write-contract` · `index.ts` idle · do not wipe gitignored `dev.db` · `pnpm --filter @moat/worker arm:plan` is idempotent.
