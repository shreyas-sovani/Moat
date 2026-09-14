# Moat build status — 2026-09-14T18:20Z

**Canonical pickup:** [`docs/CONTEXT.md`](CONTEXT.md) (read first). **Handoff:** [`HANDOFF.md`](HANDOFF.md).

**Product:** Moat — agent-guarded Morpho liquidation protection. **Testnet only.**  
**Code root:** `build2/`. **Bounty:** `bounty/` (not started).  
**Deadline:** 2026-09-18. **Network:** Base Sepolia `"84532"`.  
**Git:** `main` @ https://github.com/shreyas-sovani/Moat

## Done (gated PASS)

Phase **0.1–0.6**, Phase **1.1–1.5**, Phase **2.1–2.3**, Task **3.1**. Live Morpho position, Telegram screenshot, KH smoke workflow created+deleted, Prisma migrations committed. **CI green:** [34879998395](https://github.com/shreyas-sovani/Moat/actions/runs/34879998395).

Gate **0.2** PASS. Run [34878616724](https://github.com/shreyas-sovani/Moat/actions/runs/34878616724) failed P1012; that is closed.

## Not started

| Area | Notes |
|---|---|
| **3.2** position sync | Next. Viem reads of the existing market only |
| 3.3–3.5 worker/drill | Placeholders; drill writes through KH |
| 4.x composer/critic | Env is **Gemini Flash**, not Anthropic Opus |
| 5.x UI S2–S8 | Landing S1 only. No shadcn yet (Task 5.1) |
| 6.x fallback/breaker | |
| 7.x video/submit | Root README exists; demo video and DoraHacks form not done |
| bounty/ | Do not mix |

## Live position (do not recreate)

See CONTEXT.md §5. Market `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d`. Guardian = adversary `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`. Ratio ~70.5% of 91.5% LLTV.

## Next

**Task 3.2** live position sync against that market. Then 3.3 → 3.4 → 3.5. Always rewrite live docs to current status; after the assigned block is done, delete leftover handoff/pickup files. Nothing stale may remain.

## Bite list (short)

KH native cap ~0.001 ETH left today · REST validate 405 · Python urllib 1010 · `.next/types` `any` · Gemini not Opus · skill samples use `"8453"` / `cron` / `type: "condition"` · SQLite `DATABASE_URL=file:./dev.db` (schema-relative) · Prisma CLI must use `pnpm --filter @moat/db prisma:migrate:*` so `build2/.env` is loaded.
