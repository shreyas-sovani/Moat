# Moat build status — 2026-09-14 (post T1 seed)

**Product:** Moat (agent-guarded Morpho liquidation protection, Base Sepolia only).
**Code root:** `build2/`. **Bounty root (not started):** `bounty/`.
**Deadline:** submissions close 2026-09-18. **Network of record:** Base Sepolia `"84532"`.
**Handoff file:** `docs/HANDOFF.md`.

## What is done

- Phase 0 live verification in `build2/config/verified.json`.
- Task **0.1 PASS**. Task **0.2 PASS** (GitHub Actions `ci` green on `main`). Task **0.3 PASS** (488 actions). Task **0.4 PASS**.
- Task **0.5 PASS (T1):** permissionless WETH/USDC Morpho market + seeded position via KeeperHub.
- Task **0.6 PASS:** Telegram screenshot + same-wallet adversary.
- Phase 1: **1.1, 1.2, 1.3, 1.4, 1.5 PASS**.
- Env: Gemini Flash / Flash-Lite in gitignored `.env` (root + `build2/`).
- Landing `/` serves S1 copy.

## Live position (do not invent a new market id)

- Market `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d`
- Oracle `0x274CC0f59661d3F49aE09231C9B821bc874d0490`
- LLTV `915000000000000000` (91% disabled on this Blue)
- Supply tx `0x5d5c3589…21e6` · Borrow tx `0xa3fd3b92…9c55`
- Ratio ~**70.5%** of LLTV
- Guardian `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758` (also the drill adversary)

## What is not done

- Phase 2–7 (KH smoke/workflow evidence, worker, composer, UI S2–S8, marketplace, video, README).

## What will bite you

| Item | Impact |
|---|---|
| KH default daily native cap **0.02 ETH** | Wrap already used 0.019. Further payable KH writes wait for cap reset (~24h) or a higher org cap |
| `validate_workflow` MCP-only | Local graph validate then create |
| Next 15 `.next/types` contains `any` | Sweep source after `rm -rf apps/web/.next` |
| Python urllib → Cloudflare 1010 | Use Node `fetch` for KeeperHub |
| Composer still a placeholder | Gemini keys in env only |

## Next logical division

Phase 2: graph evidence + `pnpm --filter @moat/kh smoke`, then worker default plan / drill, then composer, then UI S2–S8.
