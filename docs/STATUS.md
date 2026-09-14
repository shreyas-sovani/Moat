# Moat build status — 2026-09-14T17:50Z

**Canonical pickup:** [`docs/CONTEXT.md`](CONTEXT.md) (read first). **Handoff:** [`HANDOFF.md`](HANDOFF.md).

**Product:** Moat — agent-guarded Morpho liquidation protection. **Testnet only.**  
**Code root:** `build2/`. **Bounty:** `bounty/` (not started).  
**Deadline:** 2026-09-18. **Network:** Base Sepolia `"84532"`.  
**Git:** `main` @ https://github.com/shreyas-sovani/Moat

## Done (gated PASS)

Phase **0.1–0.6** and Phase **1.1–1.5**. Live Morpho position + Telegram screenshot + CI green.

## Coded but NOT gated (do not skip evidence)

| Area | Code | Gate |
|---|---|---|
| KH graph builder I1–I6 | `packages/kh/src/graph.ts` + 3 tests | **2.1** journal missing |
| KH REST client | `packages/kh/src/rest.ts` + 5 tests (need ≥8) | **2.2** journal missing |
| KH smoke script | `packages/kh/scripts/smoke.ts` **never run** | **2.3** |
| Prisma 10 models | `packages/db` **no migrations** | **3.1** |
| Next landing | S1 copy only | 5.x rest not started |

## Not started

Worker loops, default plan, drill, Gemini composer/critic, UI S2–S8, marketplace/x402, demo video, bounty BUIDL.

## Live position (do not recreate)

See CONTEXT.md §5. Market `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d`. Guardian = adversary `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`. Ratio ~70.5% of 91.5% LLTV.

## Next

**Phase 2.1 journal close-out → 2.2 tests≥8 → 2.3 live smoke.** Then 3.1 migrations. Always update CONTEXT.md.

## Bite list (short)

KH native cap ~0.001 ETH left today · REST validate 405 · Python urllib 1010 · `.next/types` `any` · Gemini not Opus · skill samples use `"8453"` / `cron`.
