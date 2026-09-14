# Gate 3.2 verdict

Evaluated 2026-09-14T19:50Z against `docs/BACKLOG.md` Task 3.2.

Viem **reads only** of the existing Base Sepolia WETH/USDC market in `verified.json`. No KeeperHub writes. Morpho Blue has no `totalSupplyAssets(bytes32)` getters — those four totals are the first four returns of `market(bytes32)`. `MorphoPositionRaw` uses 1:1 collateral **assets** (`verified.json.morpho.collateralAccounting`); oracle-adjust into loan units before `computePositionRisk`.

Live command: `pnpm --filter @moat/worker sync:positions` (from `build2/`).

| AC | Result | Evidence |
|---|---|---|
| AC1 mocked viem → DB string bigints + `MorphoPositionRaw` | SAT | `ac1-unit.txt` — 3/3 tests pass (fixture upsert, second-sync same row, params mismatch throws before write) |
| AC2 live `Position` row vs Task 0.5 numbers | SAT | `ac2-live.json` — `borrowShares=31000000000000`, `collateralShares=19000000000000000`, `supplyShares=50000000000000`; all `match: true` |
| AC3 selector evidence ≥6 signatures | SAT | `ac3-selectors.txt` — **10** `cast sig` lines including `position`, `market`, `idToMarketParams` |

**Verdict: PASS**

Suite after this gate: **57** tests. Lint + build green locally.
