# Moat build status — 2026-09-14 (handoff)

**Product:** Moat (agent-guarded Morpho liquidation protection, Base Sepolia only).
**Code root:** `build2/`. **Bounty root (not started):** `bounty/`.
**Deadline:** submissions close 2026-09-18. **Network of record:** Base Sepolia `"84532"`.
**Handoff file:** `docs/HANDOFF.md`.

## What is done

- Phase 0 live verification in `build2/config/verified.json`.
- Task **0.1 PASS**. Task **0.3 PASS** (488 actions). Task **0.4 PASS**.
- Phase 1: **1.1, 1.2, 1.4, 1.5 PASS**.
- **V-F1 (guardian funding) live:** 0.08 ETH + 50 USDC + 0 WETH on `0x08df…3758`. More faucets expected.
- **V-T1 live:** Telegram integration `m2ovhyo51qj0ixr3pl3dq`, bot `@moat69bot`, KH test 200, bot `sendMessage` message_id 4.
- Env reformatted: Gemini Flash / Flash-Lite in gitignored `.env` (root + `build2/`).
- Landing `/` serves S1 copy.

## What is not done / paused

- **0.2 AC1:** OrbStack Docker OK; `act` missing; GitHub repo `shreyas-sovani/Moat` exists; **local `origin` not set**; no push / no `gh run`.
- **0.5 T1:** funds present, **no market, no wrap, no seed** — paused for extra tokens + operator go-ahead.
- **0.6 AC2 photo** + adversary wallet still open.
- **1.3 AC2** needs seeded position.
- Phase 2–7 (worker, composer, UI S2–S8, marketplace, video, README).

## What is breaking / will break

| Item | Impact |
|---|---|
| WETH = 0, `morpho.markets = []` | Cannot arm a real guard or produce demo tx hashes yet |
| Operator sending more ETH/USDC | Do not assume 0.08 / 50 is the final budget for T1 |
| `validate_workflow` MCP-only | Local graph validate then create |
| Next 15 `.next/types` contains `any` | Sweep source after `rm -rf apps/web/.next` |
| Python urllib → Cloudflare 1010 | Use Node `fetch` for KeeperHub |
| Gemini Flash not wired in `packages/agent` | Env only; composer package is still a placeholder |

## Next logical division (for the incoming agent)

After operator answers the pause questions in `docs/HANDOFF.md`: wrap WETH + create/seed Morpho market via KeeperHub (`simulate: true` first), then Phase 2 KH evidence + smoke.
