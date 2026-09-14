# Handoff — next agent (2026-09-14, after T1 seed)

Read in order: `CLAUDE.md` → `docs/PRD.md` → `docs/BACKLOG.md` → this file → `docs/STATUS.md` → `build2/docs/journal/PROGRESS.md` → `build2/docs/journal/BLOCKED.md`.

**Network of record:** Base Sepolia `"84532"` only. No mainnet. No real funds. All runtime onchain writes through `packages/kh`.

## What this session closed

- Telegram screenshot in `build2/docs/journal/vt1/screenshot.png`. Gate **0.6 PASS**. Adversary = same guardian.
- T1 Morpho market + seed via KeeperHub simulate-then-broadcast. Gate **0.5 PASS**. Gate **1.3 AC2 PASS**.
- Pushed `main` to `https://github.com/shreyas-sovani/Moat`. Gate **0.2 PASS** (`gh run` 34875987566).

## Live constants (already in `verified.json`)

- Guardian / adversary: `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`
- Market id: `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d`
- Oracle: `0x274CC0f59661d3F49aE09231C9B821bc874d0490`
- LLTV: `915000000000000000` (`isLltvEnabled(91e16)=false` on this Blue)
- Supply: `https://sepolia.basescan.org/tx/0x5d5c35890a1c6e631bd543a2c24967628741c559671a6d159b675cabacb621e6`
- Borrow: `https://sepolia.basescan.org/tx/0xa3fd3b92d5821c1658f0f04dbaec4088380c227bf8eb4a2c9b55f2abffe99c55`

## Env (never commit)

Both `/.env` and `/build2/.env`: `KEEPERHUB_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_*`, Flash model names.

## KeeperHub constraints learned this block

- Default daily native cap is **0.02 ETH**. Wrap used 0.019. Gas is not counted; ERC-20 Morpho calls are not counted.
- `GET /api/analytics/spend-cap` is live (added to `restEndpointsConfirmed.spendCap`).
- Direct `contract-call` struct args: pass a **named object** (or flattened fields), not a nested array. Nested `[tuple]` fails ethers encode.
- Simulate HTTP 400 + `failureKind: "validation"` is an encode/revert dry-run, not a malformed request wrapper bug.

## Next block

1. Phase 2 gates 2.1–2.3 (`pnpm --filter @moat/kh smoke`).
2. Worker / default plan / drill (3.x) using the live market id above — do not create another market unless this one is gone.
3. Composer uses Gemini Flash, not Anthropic.

## Quality

`pnpm lint && pnpm test && pnpm build` from `build2/` (PATH needs `~/.local/bin`). Forbidden-token grep after `rm -rf apps/web/.next`.
