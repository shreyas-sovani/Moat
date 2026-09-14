# Moat Implementation Backlog

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Moat — agent-guarded liquidation protection for Morpho on Base Sepolia — end-to-end per `docs/PRD.md`, testnet only.

**Architecture:** pnpm+turbo monorepo (`apps/web`, `apps/worker`, pure packages `risk`/`policy`, `kh` client, `agent`, `db`, `infra`). LLM composes plans at policy time only; all runtime writes go through KeeperHub; watcher/supervisor/reconciler worker loops.

**Tech Stack:** TypeScript (strict), Node 22, pnpm, turbo, vitest, biome, Next.js 15 (App Router), Prisma + SQLite, viem, `@anthropic-ai/sdk`, Tailwind + shadcn/ui, GitHub Actions.

**Upstream documents (read order):** `CLAUDE.md` (hard rules) → `docs/PRD.md` (the contract) → this backlog. On conflict: PRD wins over this backlog; live verification output (Phase 0) wins over both.

**Live implementation status (2026-09-14 evening):** see `docs/STATUS.md`, `docs/HANDOFF.md`, and `build2/docs/journal/PROGRESS.md`. Task 0.1 scaffold **PASS**. Telegram + guardian funding **integrated this block**. Tasks 0.5 market seed and 0.2 CI run still **BLOCKED** pending operator answers. Do not invent market ids. Composer/critic env is Gemini Flash (not Anthropic).

**Document philosophy — WHAT, not HOW.** Each task states: the Outcome (what exists after), Requirements (interfaces, invariants, behaviors — the contract your code must satisfy), Do-NOT (failure modes that void the task), and a Gate (numbered Acceptance Criteria with verification commands). You own the implementation. Code blocks here are interface contracts and exact expected values — treat every one as mandatory, not illustrative. Where the contract underspecifies, choose the simplest implementation that satisfies all ACs — do not gold-plate.

---

## 0. Global Rules for Every Coding Agent (read before ANY task)

### 0.1 Provenance contract (anti-hallucination)

1. No hardcoded address, chain ID, RPC URL, KeeperHub action-type string, REST path, or token decimal anywhere outside values sourced from `build2/config/verified.json` or `build2/config/action-schemas.json`. The ONLY module reading those files is `packages/infra/src/config.ts`; everything else imports from it.
2. A constant missing from `verified.json` means its PRD §3.2 verification step is not done. Do it. Never guess. All fallbacks exhausted → BLOCKED protocol (0.4).
3. `simulate` is a JSON boolean. Chain IDs are strings. Condition-node edges carry `sourceHandle: "true"|"false"`. (CLAUDE.md rules 6–9.)
4. All runtime onchain writes go through `packages/kh`. Sanctioned exception: one-time Phase 0 infra deploys in `packages/infra/scripts/` only (PRD §3.2 V-M1 T1).
5. Mainnet-impossibility: `packages/kh` MUST call `assertChainAllowed(chainId)` before every mutation; allowlist from env `CHAIN_ALLOWLIST="84532,11155111"`. A code path that can broadcast to a non-allowlisted chain is a build-killing defect (F4, see 0.3).

### 0.2 Quality gates (every task, every commit)

- `pnpm lint && pnpm test && pnpm build` green before every commit.
- TDD in `packages/risk`, `packages/policy`, `packages/kh`, `packages/agent`, `apps/worker`: the task's AC tests exist in the repo BEFORE the implementation commit that satisfies them (commit history must show test-first ordering).
- Commits: Conventional Commits (`feat:` `fix:` `test:` `chore:` `docs:`); one logical change; never mix refactor with feature.

### 0.3 GATE ENGINE — evaluation, failure classes, rework (strict)

Every task ends with a Gate of numbered Acceptance Criteria (AC). Evaluate in this exact order:

**Step 1 — Mechanical sweep (whole repo):**

```bash
# Forbidden tokens. Must print NOTHING.
grep -rnE "TODO|FIXME|XXX|HACK|it\.skip|describe\.skip|\.only\(|: any|as any|<any>" \
  apps packages --include="*.ts" --include="*.tsx"

# Provenance sweep. Must print NOTHING.
grep -rnE "0x[0-9a-fA-F]{40}" apps packages --include="*.ts" --include="*.tsx" \
  | grep -v "packages/infra/src/config.ts" | grep -v "\.test\.ts" | grep -v "fixtures"
```

(Test fixtures may contain addresses only if imported from config or named `FAKE_*`.)

**Step 2 — Task ACs:** run each AC's verification command; capture output verbatim to `build2/docs/journal/<task-id>/`. Classify every AC `SAT` or `UNSAT`.

**Step 3 — Verdict:**
- All ACs SAT + both sweeps empty + suite green → **PASS**. Record in PROGRESS.md, proceed to next task.
- Any UNSAT → **FAIL**. Assign ONE failure class per unsatisfied AC:

| Class | Meaning | Mandatory response |
|---|---|---|
| **F1 mechanical** | Command red, artifact missing, type/lint error, wrong file path | Fix directly |
| **F2 behavioral** | Output exists but wrong value, shape, ordering, or timing | Diagnose root cause; add reproducing test before fixing |
| **F3 provenance** | Unverified constant, guessed address/action-type/endpoint, value not traceable to `verified.json`/`action-schemas.json` | Delete the guess, run the missing verification, re-derive; then AUDIT every other constant the task introduced |
| **F4 safety** | Mainnet-capable path, write bypassing `packages/kh`, test weakened to pass, `simulate` as string, skipped/filtered test | Halt task; fix as highest priority; re-run the ENTIRE gate |

**Step 4 — REWORK cycle (on FAIL):**
1. Reproduce: smallest failing check that demonstrates the UNSAT AC. Commit it first.
2. Fix root cause ONLY. **Forbidden:** editing an AC or test to match observed output; loosening any schema/invariant/threshold defined in this doc or the PRD; deleting or conditionally skipping tests; widening a type to make an error disappear.
3. Re-run the ENTIRE task Gate (all ACs + sweeps), not just the failed one.
4. Append rework entry to PROGRESS.md: `REWORK <n> | AC<k> | <class> | root cause | fix`.
5. Flaky test = defect: rerun 3×; any nondeterminism → fix the race/seed, never the assertion.

**Step 5 — ESCALATION:** after 2 failed rework cycles (3 total FAILs) on one task → **BLOCKED**: write the precise question (what you tried, exact error/output, what decision you need) to `build2/docs/journal/BLOCKED.md`, mark task BLOCKED in PROGRESS.md, continue to the next unblocked task. Never silently degrade scope to force a PASS.

**Hard rule:** a PASS with any weakened AC, missing evidence file, or unrun command is itself an F4 failure. Evidence or it did not happen.

### 0.4 Trackers

- `build2/docs/journal/PROGRESS.md` — one line per task: `TASK <id> | PASS <iso-date> | <digest>` or `TASK <id> | BLOCKED | <reason>`; plus rework lines per 0.3.
- `build2/docs/journal/<task-id>/` — evidence files (command outputs, screenshots, tx hashes, API responses). One file per AC minimum.
- `build2/docs/journal/BLOCKED.md` — escalation queue.

---

## Phase 0 — Foundations & Verification

### Task 0.1: Scaffold monorepo

**Outcome:** A green pnpm+turbo TypeScript monorepo with all 8 workspaces, strict compilation, lint, test, and build pipelines working from a single command each.

**Requirements:**
1. Workspaces: `apps/web` (Next.js 15 App Router + Tailwind, src dir), `apps/worker`, `packages/{risk,policy,kh,agent,db,infra}`. Every package: `"type": "module"`, `tsconfig.json` extends root base.
2. Root `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `target ES2023`, `module NodeNext`.
3. Turbo tasks `build` / `test` / `lint`, `dependsOn: ["^build"]`.
4. Biome with `suspicious/noExplicitAny: error`.
5. Vitest workspace covering all packages; one smoke test in `packages/risk`.
6. `.env.example` with exactly the PRD §5.5 variable names; `CHAIN_ALLOWLIST="84532,11155111"` pre-filled; no real secrets.
7. `apps/web` renders default page on `pnpm dev`.

**Do NOT:** add libraries beyond the PRD stack; create empty placeholder packages beyond `src/index.ts`; configure shadcn yet (Task 5.1).

**Gate 0.1:**
- [x] AC1: `pnpm install && pnpm build && pnpm test && pnpm lint` → exit 0, all four green. [evidence: `build2/docs/journal/0.1/ac1-lint-test-build.txt`]
- [x] AC2: `pnpm vitest run --reporter=verbose 2>&1 | tail -5` → shows ≥1 passed. [evidence: `build2/docs/journal/0.1/ac2-vitest-tail.txt`]
- [x] AC3: `find apps packages -name tsconfig.json | wc -l` → `8`. [evidence: `build2/docs/journal/0.1/ac3-count.txt`]
- [x] AC4: `git log --oneline` after commit → contains `chore: scaffold moat monorepo`.
- [x] AC5: sweeps (0.3 Step 1) print nothing on source (`rm -rf apps/web/.next` first; Next generated types are gitignored). [evidence: `build2/docs/journal/0.1/ac5-sweeps.txt`]

**Status:** PASS 2026-09-14.

---

### Task 0.2: CI pipeline

**Outcome:** GitHub Actions CI that runs lint+build+test on every push — judge-visible hygiene from day one.

**Requirements:** single workflow `ci.yml`; pnpm 9 + Node 22 + frozen lockfile; the three pipeline commands; no secrets required for unit tests (copies `.env.example`).

**Do NOT:** cache shortcuts that skip install; matrix builds; deploy steps.

**Gate 0.2:**
- [ ] AC1: `act push` (or a real `gh run` if remote exists) → job exits 0. **BLOCKED 2026-09-14 evening:** OrbStack Docker OK; `act` not installed; GitHub `shreyas-sovani/Moat` exists; local `origin` unset; no push. [evidence: `build2/docs/journal/0.2/ac1-act.txt`]
- [x] AC2: workflow YAML contains exactly the three commands in order lint→build→test. [evidence: `build2/docs/journal/0.2/ac2-grep.txt`]
- [x] AC3: commit `chore: add ci` exists.

**Status:** FAIL/BLOCKED on AC1. Workflow is in `.github/workflows/ci.yml` (`working-directory: build2`). Nested copy `build2/.github/workflows/ci.yml` is for if `build2/` is published as its own repo root.

---

### Task 0.3: V-K1 — KeeperHub surface dump (HUMAN-IN-LOOP; requires KH MCP + org account)

**Outcome:** The authoritative on-disk record of KeeperHub's ACTUAL tool surface: `config/action-schemas.json` (the composer whitelist) and wallet/chain confirmations in `verified.json`.

**Requirements:**
1. Call via MCP: `tools_documentation` (read in full), `get_wallet_integration`, `list_workflows`, `list_action_schemas`. Via CLI: `kh chain list`. Raw outputs saved to `journal/vk1/`.
2. Confirm and record: Base Sepolia `84532` supported; wallet integration active; guardian wallet address in `verified.json`.
3. `action-schemas.json` shape: `{ fetchedAt, actions: [{ type, plugin, inputSchema, outputSchema }] }` — every action KeeperHub exposes, unfiltered.
4. Re-runnable dump: `packages/infra/scripts/sync-schemas.ts` (`pnpm sync:schemas`) reproduces the file; second run changes only `fetchedAt`.
5. If MCP not connected / no account: BLOCKED immediately. Simulating KH output is F3.

**Do NOT:** hand-edit `action-schemas.json`; truncate the action list; trust any doc (including PRD/analysis.md) over the live dump.

**Gate 0.3:**
- [x] AC1: `jq '.actions | length' config/action-schemas.json` → `488`. [evidence: `build2/docs/journal/0.3/ac1-actions-length.txt`]
- [x] AC2: web3 types include `web3/write-contract` and `web3/check-balance`. [evidence: `build2/docs/journal/0.3/ac2-web3-types.txt`]
- [x] AC3: `actionTypesConfirmed` + `provenance.V-K1`. [evidence: `build2/docs/journal/0.3/ac3-verified.txt`]
- [x] AC4: `pnpm sync:schemas` twice → only `fetchedAt` changes. Relative `ACTION_SCHEMAS_PATH` is resolved from the monorepo root. [evidence: `build2/docs/journal/0.3/ac4-diff-after-*.txt`]
- [x] AC5: `journal/vk1/` four MCP dumps; `kh` CLI absent so chain catalog is `GET /api/chains` (`kh-chain-list.md`, B-005).

**Status:** PASS 2026-09-14.

---

### Task 0.4: V-K2 — REST endpoint verification

**Outcome:** Every REST path `packages/kh` will call is live-probed and recorded — zero assumed endpoints.

**Requirements:**
1. Fetch docs.keeperhub.com/api (+ /direct-execution, /executions). Extract exact paths + field names for: create workflow, validate workflow, execute workflow, get execution, execution status, execution logs, direct contract-call.
2. Live-probe each harmless variant (GET list, or OPTIONS/HEAD) with the API key; record path + HTTP status.
3. Record all into `verified.json.keeperhub.restEndpointsConfirmed` as `{operation: path}`.
4. If REST lacks an operation (e.g., validate): set flag `verified.json.keeperhub.mcpOnly: ["validate_workflow", …]` — `packages/kh` will implement those against the documented MCP surface only.

**Do NOT:** copy paths from PRD/analysis.md without probing; probe with destructive calls.

**Gate 0.4:**
- [x] AC1: Req-1 operations mapped in `restEndpointsConfirmed` or `mcpOnly`. [evidence: `build2/docs/journal/0.4/ac1-rest-map.txt`]
- [x] AC2: live probes, none ≥ 500. Use Node `fetch` (Python urllib = Cloudflare 1010). [evidence: `build2/docs/journal/vk4/live-probes.json`]
- [x] AC3: `provenance.V-K2` filled.

**Status:** PASS 2026-09-14.

---

### Task 0.5: V-M1 / V-M2 / V-N1 — Morpho, oracle, network decision tree

**Outcome:** A funded, real Morpho position on a testnet, with every constant it depends on recorded in `verified.json` — whatever it took, T0/T1/T2.

**Requirements:**
1. Determine Morpho Blue presence on Base Sepolia: check docs.morpho.org addresses page + `morpho-blue-deployment` artifacts; then onchain via `cast call 0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb "market(bytes32)(…)"` with zero id against the Base Sepolia RPC. Record which branch (T0/T1/T2) and the evidence.
   - **T0:** deployment exists + viable market with faucet tokens → use it.
   - **T1:** deploy canonical MorphoBlue deterministically using the official artifacts, then create a permissionless market: loan = faucet USDC, collateral = faucet cbBTC (fallback per PRD §8.4), `LLTV = 910000000000000000` (91%), oracle + IRM from Morpho factories (Chainlink Base Sepolia feed if pair exists, else factory adapter — record which + its params).
   - **T2:** Base Sepolia unusable → repeat on Ethereum Sepolia `11155111`; set `verified.json.networkOfRecord`.
2. RPC from a public source (Chainlist/Base docs); `cast block-number` sanity check.
3. Seed liquidity: guardian supplies loan token to market; borrower position: supply collateral + borrow to ~70% of LLTV-equivalent ratio. Runtime-relevant writes via KH (`execute_protocol_action`/`execute_contract_call`, `simulate: true` first); pure setup may be scripted in `packages/infra/scripts/seed-position.ts` but still KH-routed.
4. `verified.json.morpho`: `blue`, ≥1 market `{id, collateralToken, loanToken, lltv, oracle, irm}`, tokens with decimals, all with provenance.

**Do NOT:** use mainnet canonical values as testnet truth without the onchain check; leave oracle choice unrecorded; proceed without an onchain-confirmed position.

**Gate 0.5 (MILESTONE-class):**
- AC1: `verified.json.morpho` complete per Requirement 4; `provenance.V-M1` names the branch taken + evidence file.
- AC2: `journal/vm1/` contains ≥2 tx hashes (supply + borrow) linking to the seeded position.
- AC3: `cast call <blue> "position(bytes32,address)(uint256,uint256)" <marketId> <borrower>` → BOTH values > 0. [evidence: raw output]
- AC4: A manually computed ratio (show the arithmetic in the evidence file: assets, lltv, result) lands in 60–80 %of-LLTV.

---

### Task 0.6: V-F1 / V-T1 — Faucets + notifications

**Outcome:** Both wallets funded with every token the demo needs; a working notification channel proven by delivery.

**Requirements:**
1. Guardian + adversary wallets: ETH + USDC + collateral token, via Circle faucet → Coinbase faucet → Chainlink/L2Faucet fallbacks (PRD §8.4). Balances read via KH `web3/check-balance`.
2. `test_notification` on Telegram (preferred) else Discord; record channel + config in `verified.json`.

**Gate 0.6:**
- [~] AC1: guardian × ETH/USDC/WETH recorded (`vm1/FUNDING.md`, `vt1/GATE.md`). WETH=0. Adversary wallet not separate. More faucets expected.
- [~] AC2: KH telegram test 200 + bot sendMessage id=4; `verified.json.keeperhub.telegram` filled. **Screenshot file still missing** (`journal/vt1/screenshot.png`).

**Status:** PARTIAL 2026-09-14. Do not treat as full PASS.

**PHASE 0 EXIT:** all six gates PASS; sweeps clean; ≥6 commits; PROGRESS.md current. BLOCKED items resolved or re-planned before Phase 1 starts.

---

## Phase 1 — Risk Core (pure TypeScript, zero I/O)

### Task 1.1: Config loader + verified-schema

**Outcome:** The single typed gateway to all verified constants, which structurally refuses mainnet.

**Requirements (interface contract):**
1. `packages/infra/src/verified-schema.ts` exports a Zod schema accepting `verified.json` where `network.chainId ∈ {"84532","11155111"}` — and NOTHING else (8453, 1, 42161 → parse failure).
2. `config.ts` exports: `loadVerified(): Verified` (throws with file path + Zod issues on invalid), `loadEnv(): Env` (required keys from PRD §5.5), `CHAIN_ALLOWLIST: string[]`.
3. Script `scripts/check-config.ts` loads the REAL `verified.json`; exit 0.

**Do NOT:** read `verified.json` from any other module; default-fill missing constants; coerce types silently.

**Gate 1.1:**
- [x] AC1: fixture parses; `"8453"` and `"1"` fail. [evidence: `build2/docs/journal/1.1/ac1-ac2-tests.txt`]
- [x] AC2: missing `morpho.blue` → throw contains `morpho.blue`.
- [x] AC3: `pnpm tsx packages/infra/scripts/check-config.ts` exit 0. [evidence: `build2/docs/journal/1.1/ac3-check-config.txt`]
- [x] AC4: grep `verified.json` outside infra prints nothing.

**Status:** PASS 2026-09-14.

---

### Task 1.2: Morpho share/asset math

**Outcome:** Exact integer conversions between Morpho shares and assets — the numerics everything else trusts.

**Interface contract:** `packages/risk/src/morpho-math.ts` exports
`assetsFromShares(shares: bigint, totalShares: bigint, totalAssets: bigint, direction: "up"|"down"): bigint` with EXACT semantics:
- `shares=0` or `totalShares=0` → `0n`
- `"down"` = floor(shares·totalAssets / totalShares)
- `"up"` = ceil(same) — i.e. floor + 1 iff remainder ≠ 0
- bigint-only computation; converting through `Number` anywhere in the function is F2.

**Required test values (must appear as cases, exact):**

| shares | totalShares | totalAssets | dir | result |
|---|---|---|---|---|
| 100 | 100 | 100 | down | 100 |
| 150 | 100 | 300 | down | 50 |
| 1 | 1 | 3 | up | 1 |
| 2 | 1 | 3 | up | 1 |
| 4 | 1 | 3 | up | 2 |
| 0 | 100 | 100 | up | 0 |
| 7 | 3 | 10 | down | 23 |
| 7 | 3 | 10 | up | 24 |

**Formula vs table note (2026-09-14):** the interface contract is `shares·totalAssets/totalShares`. Four of the original table rows swapped `totalShares`/`totalAssets` relative to that formula (e.g. 150/100/300 cannot yield 50 under the formula; 150/300/100 does). Tests implement the **formula** and the documented numeric results, not the swapped column order. Do not "fix" tests to match the swapped rows.

Plus one property test (≥50 random bigint triples): `up ≥ down` always, and `up - down ≤ 1`.

**Gate 1.2:** AC1 table cases green exactly; AC2 property test green; AC3 function source contains no `Number(` (grep evidence).

**Status:** PASS 2026-09-14. Evidence: `build2/docs/journal/1.2/`.

---

### Task 1.3: Position risk computation

**Outcome:** One function that turns raw Morpho state into the number the entire product orbits: `ratioOfLltvPct`.

**Interface contract:** `packages/risk/src/position-risk.ts` exports
`computePositionRisk(p: MorphoPositionRaw, m: MorphoMarketInfo): PositionRisk` with types exactly:

```ts
interface MorphoPositionRaw {
  borrowShares: bigint; collateralShares: bigint;
  totalBorrowShares: bigint; totalBorrowAssets: bigint;
  totalSupplyShares: bigint; totalSupplyAssets: bigint;
}
interface MorphoMarketInfo { lltv: bigint; loanToken: string; collateralToken: string; oracle: string }
interface PositionRisk { borrowAssets: bigint; collateralAssets: bigint; ratioOfLltvPct: number }
```

**Semantics (mandatory):**
1. `borrowAssets` = share→asset with `"up"` (conservative against borrower).
2. `collateralAssets` = share→asset with `"down"` (conservative against borrower).
3. `ratioOfLltvPct` = (borrowAssets / collateralAssets) / lltv × 100, computed in bigint with ≥1e18 internal scaling; final Number precision such that all cases below match to 6 decimal places. Formula check: borrow=91, collateral=100, lltv=0.91e18 → exactly `100`.
4. `collateralAssets = 0`: ratio `Infinity` if `borrowAssets > 0`, else `0`.
5. `borrowShares = 0` → ratio `0`.
6. If Task 0.5's onchain reads reveal collateral totals differ from supply totals (separate collateral accounting), the CALLER supplies correct totals — the function contract above stays fixed; document any such discovery in code + journal.

**Required exact cases:**

| borrow assets | collateral assets | lltv | expected ratioOfLltvPct |
|---|---|---|---|
| 91 | 100 | 0.91e18 | 100 |
| 45.5 (via shares 455/1000 of 455) | 100 | 0.91e18 | 50 |
| 10 | 0 | any | Infinity |
| 0 | 100 | any | 0 |
| 91 | 200 | 0.91e18 | 50 |

**Gate 1.3:** AC1 all five cases pass to 1e-6; AC2 a test comment block shows the hand-computation for the LIVE Phase-0 position (numbers from Task 0.5 AC4) and a live-read test reproduces it; AC3 rounding directions asserted (up for borrow, down for collateral) via boundary shares chosen so floor≠ceil.

**Status:** FAIL/BLOCKED on AC2 (no seeded Morpho position — B-001). AC1 and AC3 SAT. Evidence: `build2/docs/journal/1.3/`.

---

### Task 1.4: Breach detection + stress model

**Outcome:** The trigger decision and the counterfactual simulator (powers the watcher AND Stress Lab).

**Interface contracts:**
1. `breachDetected(risk: {ratioOfLltvPct: number}, policy: {triggerRatioPct: number}): boolean` — true iff `ratioOfLltvPct <= triggerRatioPct`. Boundary `==` → true. `Infinity` → true. `NaN` input → throws `Error` (never silently false).
2. `guardFirePoint(risk: {ratioOfLltvPct: number}, triggerPct: number): number` — collateral-drop percentage at which the trigger is first crossed, formula `d = (1 − r0/trigger)·100`, clamped to `[0, 50]`, 2-decimal precision. Case: `r0=80, trigger=110 → 27.27`. `r0 ≥ trigger → 0`. **Note (2026-09-14):** a later AC3 clause wrote `r0=105, trigger=110 → 0`, which contradicts this formula (that pair is 4.55, and 105 < 110 so it is not the `r0 ≥ trigger` clamp). Tests follow the formula + the 80→27.27 case.
3. `simulateCollateralDrop(risk, dropsPct: number[]): Array<{dropPct: number, ratio: number}>` — `ratio(d) = r0 / (1 − d/100)`; input `d` validated to `[0, 50)` (≥50 or negative → throw); output strictly increasing in `d`.

**Gate 1.4:** AC1 boundary test `==` fires and `110.01` does not; AC2 `Infinity` fires, NaN throws; AC3 fire-point case exact to 2dp + clamp cases (`r0=105, trigger=110 → 0`; `r0=10, trigger=110 → 90.91 → clamped 50`); AC4 monotonicity across `[0,10,20,30,40,49]`; AC5 throw-cases for `d=50` and `d=-1`.

**Status:** PASS 2026-09-14 against the formula (80→27.27). The `r0=105→0` clause is the documented contradiction. Evidence: `build2/docs/journal/1.4/`.

---

### Task 1.5: Policy package

**Outcome:** The user-controllable safety envelope, validated and enforceable everywhere.

**Requirements:**
1. `packages/policy/src/schema.ts`: Zod `PolicySchema` — fields and ranges EXACTLY: `triggerRatioPct: number 100–140`, `maxSpendUsd: number > 0`, `allowedActions: ["top_up","repay","withdraw_repay"]` non-empty, no duplicates, `slippageBps: 10|50|100`, `circuitBreakerMaxRunsPerDay: int 1–10 default 3`.
2. `packages/policy/src/zones.ts`: exported constants `SAFE_MIN_PCT=140`, `WARNING_MIN_PCT=115` (single source for UI zones).
3. `caps.ts`: `withinBudget(costUsd, policy)` strict `<=`; `actionAllowed(action, policy)` membership check against `allowedActions`.
4. Defaults object satisfying schema without overrides.

**Gate 1.5:** AC1 rejects trigger 99.9 and 140.01, accepts 100 and 140; AC2 rejects empty/duplicate allowedActions, rejects unknown action; AC3 budget boundary (`==` true, `+ε` false); AC4 defaults parse; AC5 `packages/risk` + `packages/policy` combined test count ≥ 25 (`pnpm vitest run 2>&1 | tail`).

**Status:** PASS 2026-09-14 (27 tests). Evidence: `build2/docs/journal/1.5/`.

---

## Phase 2 — KeeperHub Client

### Task 2.1: Workflow graph builder + invariants

**Outcome:** The ONLY way the system (hand-coded or LLM) produces KeeperHub workflow JSON — invalid graphs are unrepresentable at build time.

**Requirements:**
1. `packages/kh/src/graph.ts` exports fluent builder `wf(name, description)` with methods `trigger / readBalance / condition / action / notify / build()`. `build()` returns `{ name, description, nodes, edges }` conforming to PRD §7 node/edge structure (node `type: "trigger"|"action"|"condition"`, config per action-schemas).
2. `action({ id, if: "true"|"false"|undefined, actionType, config })` — `actionType` MUST exist in `action-schemas.json`; `if` required when the previous node is a condition.
3. `build()` throws `KhGraphError` (exported) listing ALL violations when any invariant fails.
4. **Invariants (each = one dedicated test against the REAL `action-schemas.json`):**
   - I1: every `config.network` value is a string equal to `verified.network.chainId`
   - I2: every condition node has exactly one outgoing edge with `sourceHandle:"true"` and one with `"false"`
   - I3: every `actionType` ∈ schema dump
   - I4: template refs match `^\{\{@[\w-]+:[^.\]]+\.[\w.]+\}\}$`
   - I5: any `simulate` field is `typeof boolean`
   - I6: unknown/orphan edges, dangling `if` branches, missing trigger → throw
5. Graph validator exported separately (`validateGraphJson(obj)`) so composer output (Phase 4) is checked by the SAME invariants.

**Do NOT:** accept pre-built JSON through a bypass path; special-case LLM output.

**Gate 2.1:** AC1 tests I1–I6 green using the real dump; AC2 a valid graph (trigger→read→condition→true-action/false-action→notify) builds and its JSON passes `validateGraphJson`; AC3 mutation tests: each single-invariant violation (flip one field) → `KhGraphError` naming that invariant; AC4 builder output passes KH-side validation when Task 2.3 runs (forward-compat evidence).

---

### Task 2.2: REST client — retry, idempotency, chain guard

**Outcome:** One hardened HTTP surface to KeeperHub; nothing else in the repo performs KH calls.

**Requirements:**
1. `packages/kh/src/rest.ts`: methods `validateWorkflow, createWorkflow, updateWorkflow, executeWorkflow, getExecution, getExecutionStatus, getExecutionLogs, directContractCall` — paths from `verified.json.restEndpointsConfirmed` (or MCP-only flag honored with a thrown `KhUnsupportedError`).
2. Retry: HTTP 5xx / network / body `{code:"upstream_cold_start"}` → ≤3 attempts, backoff honoring `retryAfterSeconds` when present; 4xx → NO retry, throw `KhApiError` preserving status + body.
3. Idempotency: `idempotencyKey(scope, id)` → `moat:<scope>:<id>`; create/execute always send it.
4. `assertChainAllowed(chainId)` throws `KhChainError` unless chainId ∈ `CHAIN_ALLOWLIST`; called before EVERY mutating request.
5. All fetches mocked in tests via injected `fetch` (no live network in unit tests).

**Gate 2.2:** AC1 test: 503→200 two-call sequence succeeds in exactly 2 attempts; AC2 test: cold_start body with `retryAfterSeconds:2` → second attempt observed with SAME idempotency key (capture header/body); AC3 test: 400 → `KhApiError` on attempt 1, no second attempt; AC4 test: `assertChainAllowed("8453")` throws, `"84532"` passes; AC5 key-format test `("run","r-123") → "moat:run:r-123"`; AC6 ≥8 green tests in package.

---

### Task 2.3: Live smoke against KH

**Outcome:** Proof the client speaks real KeeperHub: a workflow created, listed, deleted.

**Requirements:** script `packages/kh/scripts/smoke.ts`: build sample graph (Task 2.1 valid shape, `enabled:false`) → server-side validate → create (idempotency `moat:smoke:<date>`) → verify present via list → delete. Rerunning the script is side-effect-free.

**Gate 2.3:** AC1 exit 0 with workflow id printed; AC2 rerun → no duplicate created (same key → same id or clean create+delete cycle); AC3 evidence: validate output + create response in `journal/kh-smoke/`.

---

## Phase 3 — Guard Loop Without AI (proves the thesis before any LLM exists)

### Task 3.1: DB schema

**Outcome:** Persistent state for the whole product, exactly the PRD's model.

**Requirements:** `packages/db/schema.prisma` implements every model in PRD §4.2 with those exact model + field names (types: bigints as `String`, JSON columns as `Json`, enums as `String` with documented literal sets). `client.ts` exports Prisma singleton. Migration committed.

**Gate 3.1:** AC1 `prisma migrate status` clean on fresh clone after `pnpm i`; AC2 a seed script inserts one row per model and a test reads them back; AC3 `grep -c "^model " schema.prisma` → `10`.

---

### Task 3.2: Position sync service

**Outcome:** Worker keeps DB in sync with onchain truth for guarded wallets.

**Requirements:**
1. `apps/worker/src/sync-positions.ts`: for each wallet × market in `verified.json` → viem reads of Morpho Blue views `position(bytes32,address)`, `market(bytes32)`, `totalSupplyAssets/Shares`, `totalBorrowAssets/Shares` per market id.
2. ABI fragment file `packages/risk/src/abi/morpho.ts` containing ONLY those view signatures; every selector cross-checked via `cast sig "<signature>"` with outputs pasted to journal.
3. Upserts `Market` + `Position` (bigints as strings, `snapshotAt` set); returns the raw data needed by `computePositionRisk`.
4. Reads only — zero writes (this service never needs `packages/kh` mutations).

**Gate 3.2:** AC1 unit test with mocked viem client: fixture → correct DB rows (string bigints) + correct `MorphoPositionRaw`; AC2 live run: `Position` row matches Task 0.5's manual numbers (evidence: row dump vs journal); AC3 selector evidence file present with ≥6 signatures.

---

### Task 3.3: Watcher + execution supervisor — the money path

**Outcome:** Armed policy → breach detected → exactly one KeeperHub execution → complete run record with tx hashes, logs, cost, snapshots, alert.

**Requirements (behavioral contract):**
1. Watcher tick (30s, configurable): for every `Policy.status="armed"` → sync → compute risk → `breachDetected` → on breach: create `Run(status:"pending")` and atomically flip policy `armed→firing` (single conditional UPDATE; affected-rows ≠ 1 → another tick owns it → skip silently).
2. Fire: `executeWorkflow(guard.khWorkflowId, idempotencyKey("run", runId))` via Task 2.2 client.
3. Supervisor: poll `getExecutionStatus`, backoff 2s→30s, hard cap 15 min → terminal states: succeeded (extract `transactionHashes` via `getExecution`, `logsJson` via `getExecutionLogs`, `costUsd` from gas fields, before/after `Position` snapshots) / failed (alert + policy `needs_attention`) / timeout (= failed). On success policy returns to `armed`.
4. Alert on EVERY terminal state via the verified channel (KH notify action or direct Telegram send — whichever Task 0.6 proved).
5. Heartbeat row per tick (`watcher`, `supervisor` components).

**Do NOT:** fire while `status != "armed"`; catch-and-continue around the state machine — a thrown transition error must mark the run failed, not vanish.

**Gate 3.3:** AC1 RACE test: two concurrent watcher ticks on one breaching position → exactly 1 `Run` row, 1 executeWorkflow call (mocked client counts invocations); AC2 supervisor test: status sequence running→completed → run succeeded with txHashes+logs persisted; AC3 timeout test: never-terminal mock → 15-min cap → failed + alert called; AC4 failed-execution test → policy `needs_attention` + alert; AC5 recovery test: after success, next breach fires again (policy back to armed).

---

### Task 3.4: Hand-coded default plan, armed

**Outcome:** A real top-up guard live on KH without any LLM — the fallback that keeps the product alive even if Phase 4 fails.

**Requirements:** `apps/worker/src/arm-default-plan.ts`: builds top-up graph via Task 2.1 builder from `verified.json` market + guardian wallet + a `Policy` row (trigger 110, `maxSpendUsd` = buffer balance) → KH validate → create (`moat:plan:<uuid>`) → enable → `Guard` row `armed`. Fully idempotent (rerun → detects existing enabled guard, updates instead of duplicating).

**Gate 3.4:** AC1 script exit 0; KH workflow `enabled=true` (list-output evidence); AC2 `Guard` row status `armed` linked to policy + plan + workflow id; AC3 rerun → still exactly 1 guard row.

---

### Task 3.5: Drill — first end-to-end tx hashes (MILESTONE)

**Outcome:** The demo's proof-of-life: adversary withdrawal → guard fires → protection lands onchain, all through KeeperHub.

**Requirements:**
1. `apps/worker/src/drill.ts`: adversary collateral withdrawal sized via the stress model to push ratio past the 110 trigger (compute the needed withdrawal from `simulateCollateralDrop`/`guardFirePoint` inverse — ratio target `trigger + 5`), executed via KH `directContractCall` (`simulate: true` first, then broadcast).
2. Full loop live: worker running → drill → watcher fires → run completes.
3. Reconciliation v0: after-snapshot ratio ≥ 80% of plan's projected ratio → set `reconciledAt`.
4. Evidence pack `journal/run1/`: drill tx hash, protection tx hash(es), `get_execution_logs` export, before/after risk snapshots.

**Gate 3.5 (MILESTONE):** AC1 ≥2 linked testnet tx hashes in journal (drill + save), each resolving on the explorer built from `verified.json.network`; AC2 `Run` row: `status="succeeded"`, non-empty `txHashes` + `logsJson`, `reconciledAt` set; AC3 before/after ratios recorded and after < before by ≥15 pct-points (evidence file shows both); AC4 sweeps green, suite green.

---

## Phase 4 — Composer & Critic

### Task 4.1: Recipe enumerator + context packet

**Outcome:** The deterministic half of planning: ≤3 pre-costed candidate actions the LLM chooses among — the LLM never invents amounts.

**Requirements:**
1. `packages/agent/src/recipes.ts` (pure, no LLM): input = `PositionRisk` + market + buffer balances + policy → output ≤3 candidates `{ kind: "top_up"|"repay"|"withdraw_repay", amountAsset: bigint, estCostUsd, projectedRatioPct }`:
   - amount solves projected ratio ≥ `triggerRatioPct + 20` (tolerance ±1 pct-point);
   - candidates exceeding `maxSpendUsd` or disallowed by policy are dropped (not clamped);
   - `estCostUsd` = gas estimate + slippage on swap legs (slippage = `slippageBps` of amount; label "estimate" in output type).
2. `packages/agent/src/context.ts`: assembles the packet `{ positionSnapshot, market, policy, buffer, recipes, constants:{chainId, addresses…}, schemaWhitelist }`, Zod-validated at construction; zero free-text fields.

**Gate 4.1:** AC1 amount-solver test: for 3 fixtures the projected ratio lands in `[trigger+19, trigger+21]`; AC2 drop tests: over-budget candidate absent; disallowed kind absent; AC3 ≤3 candidates always, sorted by `estCostUsd` ascending; AC4 packet snapshot test on a fixture (full JSON committed); AC5 packet schema rejects a packet missing `constants.chainId`.

---

### Task 4.2: Composer (Opus 4.7) — structured plan output

**Outcome:** An LLM that transforms packet → valid workflow graph, physically incapable of emitting unvalidated or unwhitelisted output.

**Prerequisite:** executing agent loads the `claude-api` skill BEFORE writing SDK code.

**Requirements:**
1. `packages/agent/src/prompts/composer-system.md` — file content is a deliverable, use verbatim:

```
You are Moat's protection planner. You receive a JSON context packet describing
one Morpho position, its market, the user's protection policy, the guardian's
buffer balances, and up to three pre-costed candidate recipes computed
deterministically by Moat's risk engine.

Your job: pick the best recipe and express it as a KeeperHub workflow graph
using ONLY the builder calls available in the output schema. You must not
invent action types, addresses, or chain ids — every constant you reference
is provided in the packet's `constants` block.

Rules:
- Choose the cheapest recipe that restores ratio to at least
  trigger + 20 points, respecting policy.allowedActions and maxSpendUsd.
- If no candidate qualifies, return chosenOption=null and explain in rationale.
- rationalePlain: max 280 characters, plain English, no jargon
  ("danger line" not "LLTV").
- The workflow must include: risk read → breach condition → chosen action on
  the true branch → fallback action on the false/infeasible branch → notify.
- Respond ONLY via the compose_plan tool.
```

2. Output via tool-use, schema: `{ chosenOption: string|null, rationalePlain: string, workflow: GraphJson, alternatives: [{name, costUsd, effectOnRatioPct}] }` — `GraphJson` parsed by Task 2.1's `validateGraphJson` (failure = invalid output).
3. Model from env `COMPOSER_MODEL` (default `claude-opus-4-7`); system+schema blocks prompt-cached; packet as the final user message.
4. Invalid/unparseable output → ≤2 retries → throw `ComposerError`.
5. `rationalePlain` length enforced in code (truncate = invalid, retry).

**Do NOT:** let the model choose amounts (they come from recipes only — schema carries them, graph references them); free-text JSON parsing; temperature games — default temp.

**Gate 4.2:** AC1 with SDK mocked: 3 packet fixtures → every returned `workflow` passes `validateGraphJson` + chosen recipe is the cheapest qualifying one; AC2 invalid-JSON-then-valid mock → exactly one retry observed; AC3 always-invalid mock → `ComposerError` after retry cap; AC4 rationale length: 281-char mock output → rejected as invalid; AC5 one LIVE call logged in journal incl. non-zero prompt-cache write (`cache_creation_input_tokens > 0`) on the second identical packet.

---

### Task 4.3: Critic (Sonnet 4.6) — adversarial gate

**Outcome:** An independent model that must approve every plan; high-severity findings are hard rejections.

**Requirements:**
1. `prompts/critic-system.md` verbatim:

```
You are an independent risk reviewer. You did not write this plan and you
assume its author is wrong. Hunt for: arithmetic errors in amounts vs the
stated target ratio; slippage exceeding policy.slippageBps; actions outside
policy.allowedActions; spend exceeding maxSpendUsd; reliance on stale oracle
data (packet flags oracleFresh); wrong market or wrong party (must act for
the guardian wallet on the stated market); template references that do not
resolve to node labels present in the workflow.

verdict "reject" if ANY high-severity finding. Cite the exact field you are
rejecting. Respond ONLY via the review_plan tool.
```

2. Output: `{ verdict: "approve"|"reject", findings: [{severity: "high"|"medium"|"low", field, what, why}] }`; any `high` → reject (enforced in code, not trusted from model).
3. Model env `CRITIC_MODEL` default `claude-sonnet-4-6`. Prompt differs from composer's (no shared preamble) — verify in test.
4. Recompose loop: reject → recompose ONCE with findings attached → critic again → still reject → return BOTH plans + findings; approval remains possible only by explicit human action downstream.
5. Poison fixtures (SDK-mocked for plumbing, live-gated by env `RUN_LIVE_AGENT_TESTS=1`): (1) 2× budget → reject; (2) disallowed action → reject; (3) amount misses target by 30pts → reject; (4) `oracleFresh:false` + price-dependent action → reject; (5) clean plan → approve.

**Gate 4.3:** AC1 poison fixtures 1–5 green in plumbing mode (verdict routing + `high→reject` code enforcement); AC2 double-reject path returns both plans and does NOT auto-approve (assert final status); AC3 prompt-distinctness test (file hashes/contents differ, no common >20-token block); AC4 one live run recorded (any verdict) with token usage in journal.

---

### Task 4.4: Flow A wiring — API routes

**Outcome:** The wizard's backend: policy in → simulated, critic-reviewed, armable plan out.

**Requirements (route contract, exact):**

| Route | Request | Success | Errors |
|---|---|---|---|
| `POST /api/plans` | `{positionId, policy}` | `201 {planId, status: "proposed"\|"rejected", workflow, rationalePlain, alternatives, criticVerdict}` | `400` policy invalid (Zod issues); `502` composer/critic failure |
| `POST /api/plans/:id/simulate` | — | `200 {simulateResult}` | `409` plan not proposed; `502` KH error |
| `POST /api/plans/:id/approve` | — | `200 {guardId, khWorkflowId}` | `409` not proposed/rejected-by-user; `502` KH error |

- Approve = KH validate → create (`moat:plan:<planId>`) → enable → `Guard` armed. Idempotent: second approve returns the SAME guardId, no new workflow.
- A critic-rejected plan can still be approved ONLY with request flag `{override: true}` (recorded on the plan row as `humanOverride: true`).

**Gate 4.4:** AC1 route tests (mocked kh+agent): happy path shapes match table exactly; AC2 double-approve idempotency (same guardId, one workflow-create call); AC3 override flow: reject-path plan + no flag → 409; with flag → 200 + `humanOverride` persisted; AC4 live: `curl POST /api/plans` against the real position returns a plan whose rationale mentions the chosen action (journal).

---

## Phase 5 — Web UX (all screens, all states)

### Task 5.0: State-conformance harness

**Outcome:** "Every screen has every state" becomes a mechanical check, not a hope.

**Requirements:** `apps/web/src/lib/state-conformance.ts` + `docs/ui-states.md` table: rows = every screen (S1–S8), columns = `loading | empty | error | success`. Component renders each state from fixture providers (no network). `pnpm ui:check` parses the table and FAILS on any empty cell or any screen missing fixtures.

**Gate 5.0:** AC1 `pnpm ui:check` fails on a deliberately-emptied cell (prove the checker works), then passes on the filled table; AC2 fixture provider exists per state per screen.

---

### Task 5.1: Shell + S1 Landing + S2 Dashboard

**Outcome:** First-run product surface: land, see live positions with risk gauges, feel system liveness.

**Requirements:** per PRD §7.2 S1/S2 — additionally, hard contracts:
1. `RatioGauge`: SVG arc; zones derived from `packages/policy/zones.ts` constants ONLY (no UI-local thresholds); needle = current ratio; dashed marker = policy trigger; marker absent when unguarded.
2. `PositionCard` data binding: pair, amounts, oracle badge (source + freshness), guard chip (`Unguarded` CTA / `Armed` + distance-to-trigger in pct-points), last-run strip (time, action kind, tx link).
3. Explorer base URL derived from `verified.json.network` — zero hardcoded `basescan` strings (grep is an AC).
4. `GET /api/positions` returns positions joined with computed risk (server-side `packages/risk`), never raw-chain calls from the browser.
5. Heartbeat strip in shell; amber banner if any component age > 3× its interval.

**Gate 5.1:** AC1 `pnpm build` + typecheck green; AC2 all four states for S1+S2 screenshotted (fixture mode) in `journal/ui/`; AC3 `grep -rn "basescan\|etherscan" apps/web/src` → nothing; AC4 live: dashboard shows the Phase-0 position with ratio matching journal numbers (screenshot).

---

### Task 5.2: S3 Guard Wizard

**Outcome:** The core UX: policy → agent plan → dry-run diff → arm. Where a human approves onchain-acting AI.

**Requirements:** per PRD §7.2 S3, plus:
1. StepPolicy inputs bound to shared `PolicySchema` (same Zod instance as backend — no client re-declaration); budget max = buffer balance; slider snaps to zone boundaries.
2. StepPlanReview renders: "AI-composed" badge + rationale; chosen-vs-alternatives cost/effect table; dry-run diff (before/after ratio bars from `simulateResult`); failure-branch list; critic chip; disagreement banner (critic-rejected) with explicit "approve anyway" affordance that sends `override: true`.
3. Approve disabled until simulate result present. Post-arm strip: "Watching every 30s · Locked workflow ID … · Pause anytime."
4. Wizard states: composing / critic / simulating / error — each with distinct copy (no generic spinners).

**Gate 5.2:** AC1 live click-through: S1→S3 produces an armed guard (journal: guardId + workflow id + screenshot); AC2 all wizard states rendered from fixtures (4+ screenshots); AC3 schema-sharing: `grep` shows ONE `PolicySchema` definition imported in both apps; AC4 override banner absent on approved plan, present on rejected one (fixture test).

---

### Task 5.3: S4 Position Detail + S8 Settings

**Outcome:** Depth views: full market table, ratio history, guard status; environment transparency.

**Requirements:** per PRD §7.2 S4/S8. Hard contracts: ratio sparkline from `Position` snapshots (no new indexer); pause route flips policy status AND disables the KH workflow (idempotent); Settings shows wallet status, schema-sync timestamp, chain allowlist, "TESTNET — value is simulated" banner always visible on S8.

**Gate 5.3:** AC1 pause→verify-disabled→resume cycle against live KH (journal evidence); AC2 S4 fields complete for the live market incl. LLTV + oracle address (truncated, from config); AC3 states conformance cells filled.

---

### Task 5.4: S5 Runs / Audit Trail

**Outcome:** The judges' favorite screen: every run's full deterministic trace, raw evidence one click deep.

**Requirements:** per PRD §7.2 S5. Hard contracts:
1. Timeline steps from `Run.logsJson` — one per node execution: {status icon, label, duration, cost, tx link (URL built from `verified.json.network`), expandable raw JSON}.
2. "Verified effect" badge IFF `reconciledAt` set. Export button downloads the complete run record as JSON (headers: content-disposition attachment).
3. Before/after snapshot diff bars.

**Gate 5.4:** AC1 the Task 3.5 run renders with ≥2 linked tx hashes (screenshot + route output); AC2 export downloads valid JSON matching the DB row exactly (deep-equal test); AC3 badge logic test (reconciled vs not).

---

### Task 5.5: S6 Stress Lab + S7 Drill Console (MILESTONE)

**Outcome:** The educational closer and the live chaos-test — demo gold, zero-risk writes.

**Requirements:** per PRD §7.2 S6/S7. Hard contracts:
1. Stress: slider 0–50 → curve from `simulateCollateralDrop`, fire-point marker from `guardFirePoint`, projected-with-guard vs loss-without-guard comparison (bonus % from market config). READ-ONLY — the page imports no mutation-capable module (AC enforces).
2. Drill: amount bounded to ≤25% of collateral (enforced server-side in route, not just UI); confirm dialog; executes Task 3.5 drill logic via API; live status; links resulting run.

**Gate 5.5 (MILESTONE):** AC1 full live path S2→arm(new guard via wizard)→S7 drill→run lands in S5 (screen-record raw take now — saves Phase 7); AC2 `grep -n "packages/kh" apps/web/stress/**` (or equivalent import scan) shows stress page imports zero kh mutation symbols; AC3 drill over-cap request → 400 (route test).

---

## Phase 6 — Hardening

### Task 6.1: Failure-path drill — fallback branch

**Outcome:** Proof the non-happy path works onchain: primary action infeasible → fallback executes.

**Requirements:** drain/partially drain buffer so top-up exceeds `maxSpendUsd` → arm plan with repay fallback → drill → workflow condition takes the false/fallback branch; `Run.status="fallback"` recorded with its own tx hash; alert text names the fallback.

**Gate 6.1:** AC1 fallback tx hash on explorer + in run row; AC2 `Run.status = "fallback"` and alert payload contains "fallback"; AC3 S5 renders it distinctly from a normal success (screenshot).

---

### Task 6.2: Reconciler + circuit breaker + heartbeats

**Outcome:** The system notices its own failures — drift, runaway loops, dead components.

**Requirements:**
1. Reconciler loop (5 min): latest run per guard → onchain re-read → effect ≥ 80% of projection → set `reconciledAt`; else policy `needs_attention` + alert.
2. Circuit breaker: runs-per-day > `circuitBreakerMaxRunsPerDay` → policy paused + alert naming the breaker.
3. Heartbeats: watcher/supervisor/reconciler each write `lastTickAt`; `/api/health` exposes component ages; UI banner rule (>3× interval) wired to real data (Task 5.1 strip).

**Gate 6.2:** AC1 drift test (mocked onchain state diverges) → `needs_attention` + alert; AC2 breaker trips exactly at N+1 (N=fires, N+1 blocked) — boundary test; AC3 injected-failure live demo: script corrupts expected-effect → banner appears in UI (screenshot); AC4 `/api/health` shape: all three components with ages.

---

### Task 6.3: Test-count push + full sweep (MILESTONE)

**Outcome:** The Tradewise pattern: hygiene as evidence. 100+ tests, zero skips, CI green.

**Requirements:** gap-fill per PRD §10 table until: `pnpm vitest run` ≥ 100 tests; distribution ≥ 15 per package in risk/policy/kh/agent; worker race + supervisor suites complete; zero `skip`/`only`/`todo`; sweeps clean; `pnpm lint && pnpm build && pnpm test` green in CI on the default branch.

**Gate 6.3 (MILESTONE):** AC1 CI run green with test count ≥ 100 in output; AC2 forbidden-token + provenance sweeps empty; AC3 PROGRESS.md complete through 6.3 with no open rework lines.

---

## Phase 7 — Extras + Submission

### Task 7.1: Marketplace listing (TIMEBOX 2h — dropping is a valid outcome)

**Outcome:** Guard workflow listed on the KH marketplace with x402 per-execution pricing — or a journaled drop decision.

**Requirements:** via MCP `list_workflow`/`update_workflow_listing` (or whatever the Task 0.3 dump shows as the real listing surface); price per execution; screenshot. Mechanism absent/different → journal the finding + drop.

**Gate 7.1:** AC1 listing live with screenshot, OR `journal/marketplace.md` documents the attempt + drop reason (both are PASS states; silently skipping is FAIL).

---

### Task 7.2: README + ARCHITECTURE docs

**Outcome:** A stranger (or judge, or fresh agent) clones and runs without asking questions.

**Requirements:** `build2/README.md` sections EXACTLY in PRD §11 order; `docs/ARCHITECTURE.md` expanding PRD §4–§6 with the as-built deltas; candid Known Limitations section combining PRD §7/§16 + Phase 6 findings.

**Gate 7.2:** AC1 fresh-subagent test: dispatch a clean agent to follow README setup start→dev-server-running; it logs zero blocking questions (its transcript is the evidence); fix loop until true; AC2 section order matches PRD §11 list exactly (grep headers); AC3 known-limitations mentions testnet-only, liquidity caveats, stretch-status of on-behalf flow.

---

### Task 7.3: Demo video + evidence pack

**Outcome:** Submission artifacts that satisfy the three hard requirements (source, video, tx link).

**Requirements:** video ≤5 min in PRD §12.2 script order, recorded against live testnet; evidence pack `docs/submission/`: ≥3 tx links (drill, save, fallback), logs export, CI badge URL, screenshots.

**Gate 7.3 (MILESTONE):** AC1 video file exists, ≤5:00, hits every beat in §12.2 order (checklist attached in pack); AC2 all 3 tx links resolve on the correct explorer; AC3 evidence pack complete per list.

---

### Task 7.4: Bounty BUIDL (parallel from Day 2; separate dir `/bounty`; separate DoraHacks entry)

**Outcome:** A mergeable PR to `keeperhub/keeperhub` — or a disciplined drop.

**Requirements:** recon (90-min box): fork+clone, identify plugin/action conventions + test setup. Candidate order: (a) `morpho` position-read action (ratio-vs-LLTV + market metadata), (b) generic risk-ratio check action/trigger, (c) DX/docs PR from Phase 0 journal friction. Implement chosen candidate following repo conventions with tests, CI green, PR `feat/morpho-position-risk-actions` linking Moat. Second DoraHacks BUIDL created for the bounty track.

**Do NOT:** let bounty work consume main-track time past its timebox; open a PR that doesn't follow the repo's own test conventions (mergeability is the rubric).

**Gate 7.4:** AC1 PR open + linked in PROGRESS.md, or journaled drop decision with reason; AC2 (if PR) checks green on the PR; AC3 bounty BUIDL exists separate from main-track BUIDL (screenshot).

---

### Task 7.5: Submit

**Outcome:** Submitted, ≥12h before the wall.

**Requirements:** DoraHacks form per PRD §12.4 drafts — repo link, video, ≥3 tx links, surfaces checklist (MCP, agent-authored workflows, simulate, audit trail, DeFi plugins, triggers, CLI, marketplace/x402 status), candid "what breaks" (pull from real journal entries, including any BLOCKEDs and their resolutions), contact info.

**Gate 7.5 (FINAL):** AC1 submission confirmation screenshot; AC2 timestamp ≥12h before Sep 18, 2026 12:00 CEST; AC3 PROGRESS.md final state: every task PASS/BLOCKED-resolved, no dangling rework.

---

## Coverage & Consistency Record (plan ↔ PRD)

- PRD §3.2 verifications → 0.3–0.6 · §4.2 data model → 3.1 · Flows A/B/C/D → 4.4+5.2 / 3.3 / 1.4+5.5 / 3.5+5.5
- §5.1 client → 2.1–2.3 · §5.2 agents → 4.2–4.3 · §5.3 loops → 3.3, 6.2 · §5.4 routes → 4.4, 5.x · §5.5 env → 0.1, 1.1
- §6 reliability: double-fire 3.3 · partial failure 6.1 · run failure 3.3 · reconciliation 3.5/6.2 · heartbeats 5.1/6.2 · cold start 2.2 · oracle staleness 4.3
- §7 screens S1–S8 → 5.1–5.5 · §8 testnet plan → 0.5/0.6/3.5 · §9 safety gates → 1.5/2.1/4.3 · §10 tests → 6.3 · §11 DX → 7.2 · §12 submission → 7.3/7.5 · §13 bounty → 7.4
- Deliberate exclusions (documented non-goals, not gaps): on-behalf protection (PRD stretch), Aave adapter (non-goal), marketplace depth beyond 7.1.
- Shared identifiers used identically everywhere: `ratioOfLltvPct`, `triggerRatioPct`, `assetsFromShares(shares,totalShares,totalAssets,direction)`, `computePositionRisk`, `breachDetected`, `guardFirePoint`, `simulateCollateralDrop`, `KhGraphError`/`KhApiError`/`KhChainError`, `idempotencyKey(scope,id)` → `moat:<scope>:<id>`.
