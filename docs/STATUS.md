# Moat build status — 2026-09-14

**Product:** Moat (agent-guarded Morpho liquidation protection, Base Sepolia only).
**Code root:** `build2/`. **Bounty root (not started):** `bounty/`.
**Deadline:** submissions close 2026-09-18. **Network of record:** Base Sepolia `"84532"`.

## What is done

- Phase 0 live verification written to `build2/config/verified.json` (RPC, Morpho Blue, IRM, oracle factory, USDC, WETH, Chainlink ETH/USD + BTC/USD, KH wallet + REST map, 488 action schemas).
- Task **0.1 scaffold PASS**: pnpm+turbo monorepo, 8 workspaces, 40 tests, lint green after `next build`. Landing `/` serves S1 copy.
- Task 0.2 CI YAML committed (`chore: add ci`); **AC1 blocked** until Docker/`act` or a GitHub remote exists.
- Packages already implemented ahead of their phase gates (evidence still being closed): `@moat/infra` config, `@moat/risk` math, `@moat/policy` schema, `@moat/kh` graph+REST client, Prisma schema (10 models), Next landing S1 copy.

## What is not done

- Task 0.2 CI gate (YAML exists, `act`/`gh run` not proven).
- Tasks 0.5–0.6 (market seed, faucets, notifications) — **BLOCKED** on funding + KH Telegram/Discord integration.
- Worker loop, composer/critic, dashboard S2–S8, marketplace, demo video, README.

## What is breaking / will break

| Item | Impact |
|---|---|
| Guardian wallet has 0 ETH / 0 USDC / 0 WETH | No onchain drill, no seeded Morpho position, no demo tx hash |
| No Morpho market id on 84532 (GraphQL unsupported; none recorded) | Watcher/sync cannot target a live position |
| No KH notification channel | Guard alerts and V-T1 cannot pass |
| `validate_workflow` is MCP-only and needs a stored workflow id | Local graph validation + create is the path; do not call REST validate |
| Next 15 emits `any` in `apps/web/.next/types` | Forbidden-token grep of `apps packages` after `next build` hits generated files; `.next` is gitignored; sweep source only |
| Backlog 1.2 table swapped `totalShares`/`totalAssets` on four rows vs the written formula | Tests follow `shares * totalAssets / totalShares` |
| Backlog 1.4 says `r0=105, trigger=110 → 0` but formula `d=(1-r0/trigger)*100` yields 4.55 | Tests follow the formula + the 80→27.27 case |
| Morpho `position.collateral` is assets, not shares | Callers of `computePositionRisk` must pass 1:1 collateral totals (recorded in `verified.json.morpho.collateralAccounting`) |
| Parent `.env` key is `keeperhub_api_key`; build2 expects `KEEPERHUB_API_KEY` | Copy into gitignored `build2/.env` before live KH smoke |
| `packages/agent` and `apps/worker` are placeholders | Phase 3–4 not started |

## Next logical division

Close Task 0.3 / 0.4 evidence gates from the live dumps already on disk. Tasks 0.5–0.6 stay blocked on faucets + KH Telegram.
