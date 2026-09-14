# Moat — agent pickup context (canonical)

**If you are a new agent, read this file first, then follow the read order below. Do not reconstruct history from chat. Do not invent addresses, market ids, REST paths, or action types.**

**Last updated:** 2026-09-14T18:20:00Z (2.1–2.3 + 3.1 PASS; CI green again).  
**Maintainer rule:** every session that changes product state, onchain state, env, KH behavior, or gate status MUST update this file, `docs/STATUS.md`, `docs/HANDOFF.md`, `build2/docs/journal/PROGRESS.md`, and `build2/docs/journal/BLOCKED.md` before finishing. Stale docs are a defect.

---

## 0. Read order (do not skip)

1. This file (`docs/CONTEXT.md`)
2. `CLAUDE.md` — hard KeeperHub rules (with live exceptions noted here)
3. `docs/PRD.md` — product contract. **Live verification wins on conflict.**
4. `docs/BACKLOG.md` — task gates. Execute in order. Do not skip to Phase 4–7.
5. `docs/STATUS.md` — dashboard
6. `docs/HANDOFF.md` — next-block pointer
7. `build2/docs/journal/PROGRESS.md` + `BLOCKED.md`
8. `build2/config/verified.json` — only source of addresses/endpoints
9. Skills: `docs/agent-skills/SKILL.md` then `mcp-tools-reference.md` then `workflow-patterns.md`  
   **Treat skill samples as stale** where they conflict with this file (mainnet `"8453"`, `cron` vs `scheduleCron`, Condition `conditions[]` vs live `config.group.rules`).

On conflict: **live `verified.json` + journal evidence > PRD > backlog > analysis.md / product.md / skill samples.**

---

## 1. What this repo is

**Moat** = agent-guarded Morpho liquidation protection on **Base Sepolia only** (`chainId` string `"84532"`). No mainnet. No real funds. v1 is **self-guard**: the KeeperHub org wallet holds the Morpho position and the protection buffer. The demo adversary is **the same wallet**.

Hackathon: KeeperHub Agent Economy (DoraHacks), submissions close **2026-09-18**. Need: KH execution tx hash, demo video, public repo.

| Path | Role |
|---|---|
| `/Users/shreyas/Desktop/keeperhub` | Git root, public remote `https://github.com/shreyas-sovani/Moat` branch `main` |
| `build2/` | **Only code root** (pnpm+turbo monorepo) |
| `bounty/` | Separate bounty BUIDL — **not started, do not mix** |
| `docs/` | PRD, backlog, this file |
| `build2/config/verified.json` | Live constants |
| `build2/config/action-schemas.json` | 488 KH actions, dump via `pnpm sync:schemas` |
| `build2/docs/journal/` | Gate evidence. A PASS without a file here is invalid. |

**Owner GitHub:** `shreyas-sovani`. **Do not force-push. Do not commit `.env`.**

---

## 2. Gate dashboard (truth)

| Task | Status | Notes |
|---|---|---|
| 0.1 scaffold | **PASS** | 8 workspaces, biome; **40 tests at gate**, suite now **54** |
| 0.2 CI | **PASS** | Latest green: [34879998395](https://github.com/shreyas-sovani/Moat/actions/runs/34879998395) (migrate+lint+build+test). First green: [34875987566](https://github.com/shreyas-sovani/Moat/actions/runs/34875987566). [34878616724](https://github.com/shreyas-sovani/Moat/actions/runs/34878616724) failed P1012 (`DATABASE_URL`) — fixed. |
| 0.3 V-K1 | **PASS** | 488 actions |
| 0.4 V-K2 | **PASS** | REST mapped; `validate_workflow` MCP-only |
| 0.5 V-M1 T1 | **PASS** | Live WETH/USDC market + position |
| 0.6 V-F1/V-T1 | **PASS** | Telegram screenshot; adversary = guardian |
| 1.1–1.5 risk/policy | **PASS** | 1.3 AC2 uses live AC4 numbers |
| **2.1 graph** | **PASS** | I1–I6 tests; Condition = KH `actionType: "Condition"`. `journal/2.1/` |
| **2.2 REST client** | **PASS** | 11 unit tests. `journal/2.2/` |
| **2.3 KH smoke** | **PASS** | create `4nejcqnx21wsfxquxosk0` then delete; rerun same key no duplicate. `journal/kh-smoke/` |
| **3.1 DB** | **PASS** | migration `20260914180000_init` committed; seed + test. `journal/3.1/` |
| **3.2 position sync** | **NOT STARTED** | Next. Viem reads of the **existing** market only |
| 3.3–3.5 worker/drill | **NOT STARTED** | Placeholders only |
| 4.x composer/critic | **NOT STARTED** | Env is **Gemini Flash**, not Anthropic Opus |
| 5.x UI S2–S8 | **NOT STARTED** | Landing S1 only. No shadcn yet (Task 5.1) |
| 6.x fallback/breaker | **NOT STARTED** | |
| 7.x README/video/submit | **NOT STARTED** | Public repo + root README exist; video and DoraHacks form not done |
| bounty/ | **NOT STARTED** | |

**Next logical block:** **Task 3.2** — viem position sync against the **existing** WETH/USDC market. Then 3.3 → 3.4 → 3.5. Do **not** create another Morpho market. Do **not** start composer/UI until 3.4/3.5 path is unblocked.

---

## 3. Machine / toolchain (this laptop)

```
export PATH="$HOME/.local/bin:$HOME/.foundry/bin:$PATH"
cd /Users/shreyas/Desktop/keeperhub/build2
```

| Tool | Where |
|---|---|
| pnpm 9.15.9 | `~/.local/bin/pnpm` |
| Node 22 | required by engines |
| cast (Foundry) | `~/.foundry/bin/cast` |
| gh | logged in as `shreyas-sovani` |
| Docker / OrbStack | available; `act` **not** installed (CI uses GitHub-hosted runners) |
| Python urllib to KH | **Cloudflare 1010 — never use.** Node `fetch` only. |

Quality before every commit (from `build2/`):

```
pnpm lint && pnpm test && pnpm build
rm -rf apps/web/.next
# forbidden-token + provenance greps in BACKLOG §0.3 must print nothing
```

Biome: tabs, `noExplicitAny: error`. Provenance: no `0x`+40 hex in `apps`/`packages` except `packages/infra/src/config.ts`, `*.test.ts`, `fixtures`. Zero address lives at `ZERO_ADDRESS` in `config.ts`. Seed script hashes salt/topic via `cast` so they are not hardcoded.

CI: repo-root `.github/workflows/ci.yml` with `working-directory: build2`. Steps: copy `.env.example` → `.env` → `pnpm i` → **migrate deploy** (`DATABASE_URL=file:./dev.db` on the step) → lint → build → test.

Prisma CLI runs from `packages/db` and does **not** load `build2/.env` by itself. Always go through `pnpm --filter @moat/db prisma:migrate:*` (`scripts/run-prisma.ts` loads `build2/.env` and defaults `DATABASE_URL=file:./dev.db`). Raw `prisma migrate deploy` in that package with no env → P1012. Nested `build2/.github/workflows/ci.yml` is unused while git root is the parent repo.

Commits: Conventional Commits. Test-first in `risk`/`policy`/`kh`/`agent`/`worker`.

---

## 4. Env (gitignored — never print secrets, never commit)

Both `/Users/shreyas/Desktop/keeperhub/.env` and `build2/.env` are `KEY=value`. Required names (see `build2/.env.example`):

| Key | Live value / note |
|---|---|
| `KEEPERHUB_API_KEY` | org key `kh_…` — set |
| `COMPOSER_MODEL` | **`gemini-2.5-flash`** (PRD said Opus; operator override) |
| `CRITIC_MODEL` | **`gemini-2.5-flash-lite`** |
| `GEMINI_API_KEY` | set |
| `ANTHROPIC_API_KEY` | unused |
| `DATABASE_URL` | `file:./dev.db` — Prisma CLI + `resolveDatabaseUrl` resolve this next to `packages/db/prisma/schema.prisma` (`packages/db/prisma/dev.db`, gitignored). Do **not** use `file:./packages/db/prisma/dev.db` with Prisma CLI (that nests `prisma/prisma/`). |
| `RPC_URL_84532` | `https://sepolia.base.org` |
| `TELEGRAM_BOT_TOKEN` | set (bot `@moat69bot`) |
| `TELEGRAM_CHAT_ID` | private chat; getUpdates historically `5151519003` — **only in .env** |
| `CHAIN_ALLOWLIST` | `84532,11155111` |
| `VERIFIED_JSON_PATH` | `./config/verified.json` (resolved from **monorepo root** `build2/`) |
| `ACTION_SCHEMAS_PATH` | `./config/action-schemas.json` |
| `RUN_LIVE_AGENT_TESTS` | `0` |

Parent `.env` originally had lowercase `keeperhub_api_key` and dumped Telegram JSON; cleaned. `EnvSchema` includes optional `GEMINI_API_KEY`.

---

## 5. Live onchain state (Base Sepolia) — do not invent a new market

**Guardian / adversary (same):** `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`  
KH web3 integration: `nn8bdw0xa4x1rgrg2aztw`

| Item | Value |
|---|---|
| RPC | `https://sepolia.base.org` |
| Explorer | `https://sepolia.basescan.org` |
| Morpho Blue | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (HAS_CODE, CREATE2) |
| IRM | `0x46415998764C29aB2a25CbeA6254146D50D22687` (`isIrmEnabled=true`) |
| Oracle factory | `0x2DC205F24BCb6B311E5cdf0745B0741648Aebd3d` |
| USDC (6) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| WETH (18) | `0x4200000000000000000000000000000000000006` |
| ETH/USD feed | `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1` (8 decimals) |
| BTC/USD feed | `0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298` (unused; cbBTC has **no code** on Sepolia) |
| Morpho owner | `0x937Ce2d6c488b361825D2DB5e8A70e26d48afEd5` (we cannot `enableLltv`) |
| **Market id** | `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d` |
| **Oracle** | `0x274CC0f59661d3F49aE09231C9B821bc874d0490` (`isMorphoChainlinkOracleV2=true`) |
| **LLTV** | `915000000000000000` (**91.5%**. `isLltvEnabled(91e16)=false`) |

### Position at seed (2026-09-14T17:34:53Z)

`cast call $BLUE "position(bytes32,address)(uint256,uint128,uint128)" $MARKET $GUARDIAN`

- supplyShares = `50000000000000`
- borrowShares = `31000000000000`
- collateral = `19000000000000000` (0.019 WETH **assets**, not shares)

`market(bytes32)`: totalSupplyAssets=`50000000` (50 USDC), totalBorrowAssets=`31000000` (31 USDC), fee=0.

Wallet after seed: ETH `0.061`, USDC `31` (the borrowed amount), WETH `0` (all in Morpho collateral). Operator may send more tokens after 24h.

Ratio at seed oracle price: **70.526% of LLTV** (band 60–80 SAT). Arithmetic in `build2/docs/journal/vm1/ac4-ratio.txt`.

### All T1 txs (receipts `status=0x1`)

Full table: `build2/docs/journal/vm1/TXS.md`. Hackathon-relevant pair:

- supply https://sepolia.basescan.org/tx/0x5d5c35890a1c6e631bd543a2c24967628741c559671a6d159b675cabacb621e6
- borrow https://sepolia.basescan.org/tx/0xa3fd3b92d5821c1658f0f04dbaec4088380c227bf8eb4a2c9b55f2abffe99c55

Also: wrap `0x91a659a8…c957`, oracle `0xf22b3c1d…9b48`, createMarket `0x38316d71…0bc8`, approve USDC `0x4105fd1f…e574`, approve WETH `0xd58c8223…2d12`, supplyCollateral `0xda22eba6…a51d`.

Idempotency keys already used (do not reuse for new work): `moat:t1v2:{wrap,oracle,createMarket,approveUsdc,approveWeth,supply,supplyCollateral,borrow}`, `moat:smoke:2026-09-14`. Format is `moat:<scope>:<id>`. Smoke key is date-stamped; a rerun *today* returns the deleted id and must not create a second workflow.

Seed script (KH-routed, resumable): `build2/packages/infra/scripts/seed-position.ts` (`pnpm --filter @moat/infra seed:position`). State: `build2/docs/journal/vm1/seed-state.json`.

### Oracle factory params actually used

`createMorphoChainlinkOracleV2` on the factory:

| Arg | Value | Why |
|---|---|---|
| baseVault | `address(0)` | WETH is not an ERC4626 |
| baseVaultConversionSample | `1` | required when vault is zero |
| baseFeed1 | ETH/USD | collateral WETH |
| baseFeed2 | `address(0)` | price=1 |
| baseTokenDecimals | `18` | WETH |
| quoteVault | `address(0)` | USDC not a vault |
| quoteVaultConversionSample | `1` | |
| quoteFeed1/2 | `address(0)` | USDC treated as $1 (Morpho docs) |
| quoteTokenDecimals | `6` | USDC |
| salt | `cast keccak "moat-weth-usdc-84532-v1"` | CREATE2 |

### Market id formula

`keccak256` of **five 32-byte words** (loan, collateral, oracle, irm, lltv) — Morpho `MarketParamsLib`. **No 4-byte selector.** `cast abi-encode "f(…)"` happens to omit selector too, but prefer explicit padding. `idToMarketParams` confirmed the id.

---

## 6. KeeperHub — live facts vs docs/skills

REST base: `https://app.keeperhub.com` (paths already include `/api`; **do not double**). MCP: `https://app.keeperhub.com/mcp`. Cursor session often has **no KeeperHub MCP namespace** — use REST + API key.

### Confirmed REST (`verified.json.keeperhub.restEndpointsConfirmed`)

Includes workflows CRUD (`POST /api/workflows/create` not `/api/workflows`), execute, execution status/logs/wait, `POST /api/execute/transfer`, `POST /api/execute/contract-call`, `GET /api/execute/{executionId}/status`, chains, schemas, integrations, keys, **`GET /api/analytics/spend-cap`**.

### MCP-only

`validate_workflow`. Live `POST /api/workflows/validate` → **405**. MCP validate needs a **stored `workflowId`**. Workaround: local `validateGraphJson` then `createWorkflow`. `KeeperHubClient.validateWorkflow` rejects with `KhUnsupportedError`.

### Direct contract-call body (docs.keeperhub.com/api/direct-execution)

- `chainId`: string `"84532"` (number also accepted; **never `"8453"`**)
- `functionName` canonical; `abiFunction` alias
- `abi`: **JSON string**
- `functionArgs`: **JSON array string** (not a raw array)
- `value`: native amount as **decimal ether string** (e.g. `"0.019"`), not wei
- `simulate`: **boolean** `true` first. Omit the field to broadcast (`false` also works). Strings rejected.
- Simulate does **not** consume spending cap. Successful sim: HTTP 200 `{status:"simulated", wouldRevert:false}`. Would-revert: HTTP **400** `{failureKind:"validation"|"revert", wouldRevert:true}` — not a malformed client.
- Broadcast often HTTP **202** `{status:"completed", transactionHash, executionId}`. Poll `GET /api/execute/{executionId}/status` if pending/unconfirmed.
- **Do not reuse one Idempotency-Key across simulate and broadcast.**
- Structs: pass a **named object** or **flattened fields**. Nested `[[a,b,c,d,e]]` → ethers `invalid address` on `loanToken`. Proven with createMarket + supply simulates.

### Caps (as of seed)

`GET /api/analytics/spend-cap` → `effectiveDailyCapWei=20000000000000000` (**0.02 ETH** default), `dailyUsedWei` after wrap ≈ `19000000000000000`. **Remaining ~0.001 ETH native.** Gas is not counted. ERC-20 / Morpho calls are not native-capped. Stablecoin moves capped **100 USD per tx**; 50 USDC supply and 31 USDC borrow are under. Approves to protocol spenders can exceed 100 USD; we approved exact amounts.

**Do not wrap more ETH today** unless remaining cap is re-checked. Operator sending more faucet tokens after 24h does **not** raise the KH daily cap.

### Condition / schedule / telegram (code already matches live KH)

Builder in `packages/kh/src/graph.ts` uses:

- Schedule field **`scheduleCron`** + `scheduleTimezone` (not `cron`)
- Condition `config.group.rules[]` with `leftOperand` / `operator` / `rightOperand` (not skill-sample `conditions` array)
- Condition **node type** is `"action"` with `actionType: "Condition"` (KH schema allows only `trigger`|`action`; `type: "condition"` is rejected/wrong). `validateGraphJson` I2 still accepts legacy `type: "condition"`.
- Edges `sourceHandle: "true"|"false"`

`telegram/send-message` required fields are **`chatId` + `message`** (optional `parseMode`). Org integration `m2ovhyo51qj0ixr3pl3dq` is bound at KH plugin level; do not put `integrationId` on the node. Smoke uses `TELEGRAM_CHAT_ID` from env (redacted in journal). ChatId `"0"` is invalid for live Telegram. Bot `@moat69bot`. Screenshot: `build2/docs/journal/vt1/screenshot.png`.

### Client already in repo (`packages/kh`)

`KeeperHubClient`: create/update/delete/list workflows, execute, getExecution/status/logs, `directContractCall`. Injected `fetch` in tests. Retry: 5xx + `upstream_cold_start` ≤3, same Idempotency-Key; 4xx no retry. `assertChainAllowed` before mutations. `idempotencyKey("run","r-123")` → `moat:run:r-123`. Gate 2.2: **11** unit tests. `validateWorkflow` → rejected `KhUnsupportedError` (REST 405); use `validateGraphJson`.

`listWorkflows` is a **bare array** of workflow objects with `id` (confirmed 2026-09-14 smoke). Helper `workflowRows` also accepts `{ workflows: [...] }` / `{ data: [...] }`. `createWorkflow` returns the full workflow including `id`. `deleteWorkflow` returns `{ success: true }`. After delete, the same idempotency key returns the same `id` **without** re-inserting it into the list.

No `getDirectExecutionStatus` helper yet (seed script raw-fetches `directExecutionStatus`). No `execute_protocol_action` REST (never probed — do not add a path without a live probe). T1 used **contract-call**, not protocol actions.

### Skill / CLAUDE.md traps

- CLAUDE.md example chain `"8453"` is **Base mainnet**. Moat allowlist is only `84532` and `11155111`.
- Always `simulate: true` before KH writes. Always `get_wallet_integration` / list integrations first.
- `tools_documentation` first if MCP is connected; otherwise REST schemas + this file.
- Workflow-patterns Morpho example uses `"8453"` and fake `market` field — **ignore**. Morpho plugin needs `loanToken, collateralToken, oracle, irm, lltv, assets, onBehalf` (see `action-schemas.json`). There is **no** `morpho/create-market`.

---

## 7. Spec deltas (do not “fix” tests to the wrong AC)

- Backlog 1.2 table swapped some `totalShares`/`totalAssets` vs formula `shares*totalAssets/totalShares`. Tests follow **formula**.
- Backlog 1.4 clause `r0=105, trigger=110 → 0` contradicts the fire-point formula. Tests follow **formula** (80→27.27 style).
- PRD LLTV 91% **cannot be created** on this Blue. Market is 91.5%. Documented in V-M1.
- PRD composer Opus / critic Sonnet → env is **Gemini Flash / Flash-Lite**.
- Morpho GraphQL `chainId 84532` unsupported — no indexed markets; we created our own.
- Collateral: Blue `position.collateral` is **assets**. `computePositionRisk` share math is same-unit; oracle-adjust into loan-token units before calling it (see 1.3 live test).
- Forbidden-token grep after `next build` hits generated `any` in `.next/types` — sweep **source** after `rm -rf apps/web/.next`.

---

## 8. Code map (what exists vs placeholders)

| Package | State |
|---|---|
| `packages/infra` | Zod `VerifiedSchema` (chainId only `84532`\|`11155111`), loaders, `check-config`, `sync-schemas`, `seed-position` |
| `packages/risk` | morpho math, position-risk, breach, view ABI fragment |
| `packages/policy` | Zod policy schema |
| `packages/kh` | graph builder I1–I6 (KH Condition shape), REST client (11 tests), smoke **PASS** |
| `packages/db` | Prisma 10 models, migration `20260914180000_init`, `seedMinimal` + `pnpm --filter @moat/db seed` |
| `packages/agent` | placeholder `export const agentPackage` |
| `apps/worker` | placeholder idle log |
| `apps/web` | Next 15 landing S1 only |

Monorepo: pnpm workspaces, turbo `dependsOn: ["^build"]`. Vitest aliases `@moat/*`.

---

## 9. How to close 3.2 (your job unless blocked)

Viem **reads** of the **existing** market in `verified.json` (do not create another). ABI fragment in `packages/risk/src/abi/morpho.ts` — every selector via `cast sig`, paste to `journal/3.2/`. Upsert `Market` + `Position` (bigints as strings). Zero KH writes in this service.

Gate: mocked viem unit test; live `Position` row vs Task 0.5 journal numbers; selector evidence ≥6 signatures.

Then 3.3 watcher/supervisor (mocked executeWorkflow counts), 3.4 arm default plan (`enabled: true` on KH), 3.5 drill via `withdrawCollateral` through KH (`simulate: true` first). Do not wrap more ETH.

---

## 10. After 3.2–3.5

4.x: Gemini Flash, not Anthropic.  
5.x: shadcn at 5.1; verify UI in a browser.  
7.x: README (exists), video, DoraHacks form listing MCP, audit trail, simulate, DeFi plugins.

---

## 11. Doc maintenance protocol (mandatory)

Before you claim a task complete:

1. `PROGRESS.md` line for the task.
2. `journal/<task-id>/` evidence files.
3. `STATUS.md` dashboard.
4. **This file** (`CONTEXT.md`) — especially live balances, caps, new endpoints, new gotchas.
5. `HANDOFF.md` next-block list (rewrite to the *new* next block; do not append a second handoff).
6. `BLOCKED.md` open/closed.
7. `verified.json` if any constant changed, then `pnpm --filter @moat/infra check:config`.
8. Commit. Push `main` if the operator already authorized (they did for this repo).

If you learned a KH/Morpho fact the hard way (encoding, caps, 405s), it belongs **here**, not only in chat.

### End-of-block hygiene (after the assigned block is fully done)

When the work you were given is gated PASS end-to-end:

1. Rewrite every *live* doc so it describes **now** only: done / next / blocked. Present tense. No leftover "next is 2.1" if 2.3 just passed.
2. **Delete** prior-agent pickup/handoff artifacts and any other file that would mislead the next agent: extra `HANDOFF*` copies, `SESSION*` / `PICKUP*` / agent-prompt notes, dated status duplicates, journal extracts that contradict live CONTEXT.
3. Do **not** delete gate journals (`build2/docs/journal/<task>/`), `verified.json`, PRD, backlog, or skill files. Keep one `docs/HANDOFF.md` and rewrite it; do not leave two handoffs.
4. Grep the repo for stale gate claims (e.g. "2.1 NOT GATED" after 2.1 PASS). Fix or delete until nothing contradicts CONTEXT.
5. Two files that disagree on gate status is a defect. Stale docs are a defect.
