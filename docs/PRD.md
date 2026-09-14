# Moat — PRD (Product Requirements Document)

**Source of truth hierarchy:** this PRD > `docs/product.md` (rationale) > `docs/analysis.md` (ecosystem reference) > `CLAUDE.md` (hard rules). If any doc conflicts with live verification output (§3), live output wins and the doc gets updated.

**Project root:** `/Users/shreyas/Desktop/keeperhub/build2` (main BUIDL)
**Bounty BUIDL:** `/Users/shreyas/Desktop/keeperhub/bounty` (separate — §13)

---

## 0. Locked Constraints (from user, non-negotiable)

1. **Testnet only. No mainnet. No real funds.** All value movement is testnet tokens with zero real-world value.
2. **Bounty BUIDL pursued separately** (separate directory, separate DoraHacks BUIDL entry).
3. **Build everything under `/build2`** (main) and `/bounty` (bounty).
4. **LLM choice: composer = Claude Opus 4.7 (`claude-opus-4-7`), critic = Claude Sonnet 4.6 (`claude-sonnet-4-6`)** — different model families' weights avoided by using different models for decorrelation; critic must not share the composer's prompt. Rationale: Opus for composition quality, Sonnet for adversarial review at 5x lower cost; a same-model pair with same prompt correlates errors.
5. **4-day window, full scope.** The executing agent builds end-to-end following §14 step by step.

---

## 1. Product Summary

Moat is agent-guarded liquidation protection for Morpho borrowers on Base Sepolia. A user with a borrowed Morpho position:

1. Sees live risk (per-market borrow/collateral ratio vs. LLTV, oracle status, liquidation price).
2. Sets a protection policy (threshold, budget, allowed actions, slippage).
3. Receives an agent-composed protection plan (a KeeperHub workflow), red-teamed by a critic agent, reviewed as a dry-run diff.
4. Approves once → the workflow is armed on KeeperHub.
5. When the position breaches the policy threshold, KeeperHub executes the plan deterministically (top-up collateral / repay debt / withdraw-and-repay, with an optional swap leg). Every run produces tx hashes + a full audit trail surfaced in the Moat UI.

**Core invariant (the demo's one-liner):** LLM inference happens exactly once, at plan time, behind human approval. The execution path is 100% deterministic KeeperHub workflow. "The agent plans, you approve, the chain executes."

### 1.1 Onchain actor model

- **The guarded wallet is the KeeperHub organization wallet** (Turnkey non-custodial). All protection writes (supply collateral, repay) execute from it via KeeperHub. This is the v1 "self-guard" flow: the org wallet holds the position **and** the protection buffer (collateral tokens reserved for top-ups).
- **Stretch (on-behalf flow):** Morpho's Blue SDK exposes supply-on-behalf and repay-on-behalf calls, letting the KH wallet protect a position held by a *different* wallet. Implement only if T0/T1 verification (§3.3) confirms the action surface supports `onBehalf` parameters, and only after the self-guard flow is complete. Do not block v1 on it.
- **The adversary in demos is us:** breach is induced by withdrawing collateral from the borrower position — and this adversarial write ALSO goes through KeeperHub (`web3/write-contract` / morpho withdraw action) so the audit trail shows both sides. Never simulate a breach by moving an oracle on testnet (testnet Chainlink feeds are frequently stale — §8).

---

## 2. Goals and Non-Goals

### Goals (v1 — the hackathon build)

| # | Goal | Proof artifact |
|---|---|---|
| G1 | Live position dashboard reading real Morpho markets on Base Sepolia | Screen recording + working app |
| G2 | Risk engine computing per-market ratio vs. LLTV, breach detection | Unit tests (100+ across repo) |
| G3 | Composer agent producing valid KH workflow JSON, constrained to live action schemas | Schema-conformance tests + real `validate_workflow` pass |
| G4 | Critic agent rejecting bad plans (injected-fault test suite) | Test showing critic kills a poisoned plan |
| G5 | Arm → breach → save loop fully onchain via KeeperHub, testnet | ≥3 tx hashes on Basescan Sepolia + `get_execution_logs` export |
| G6 | Audit-trail UI: every run's full step timeline with tx links | Working screen |
| G7 | Failure paths demonstrated: insufficient buffer → fallback action branch; workflow failure → alert + needs-attention state | Screen recording of each |
| G8 | Stress Lab: "what if collateral drops X%" simulator | Working screen |
| G9 | Marketplace listing of the guard workflow with x402 per-execution price (timeboxed 2h) | Listing screenshot |
| G10 | Bounty PR to `keeperhub/keeperhub` (separate BUIDL) | Open PR link |

### Non-Goals (v1)

- Mainnet anything.
- Real user funds, payments, or fee collection. (Fee logic exists as policy metadata + display only.)
- Aave V3 support. (Risk engine takes `protocol` adapter interface so Aave can be added later; ship only the Morpho adapter.)
- Non-custodial "connect your own wallet" onboarding with signatures. v1 onboards users as KH-org members or demo accounts; the "user" is the org wallet owner.
- Mobile-native. Responsive web down to 375px is enough.
- Multi-language, theming, marketing site polish beyond a single landing view.

---

## 3. Facts Table — verified vs. must-verify (the anti-hallucination contract)

**Rule for the executing agent:** you may not hardcode ANY address, tool name, action type, REST endpoint, package name, or chain parameter that is not (a) listed in §3.1 as VERIFIED, or (b) written into `build2/config/verified.json` by completing a §3.2 verification step, with provenance recorded. If a verification step fails, follow its fallback. If all fallbacks fail, STOP and mark the step BLOCKED with a precise question — never guess.

### 3.1 Pre-verified facts (researched Sep 14, 2026, with sources)

| Fact | Value | Source |
|---|---|---|
| Chain | Base Sepolia, chain ID `"84532"` (string) | docs.analysis.md §7 chain table |
| KeeperHub MCP | `https://app.keeperhub.com/mcp` | docs.keeperhub.com/ai-tools/mcp-server |
| KeeperHub REST base | `https://app.keeperhub.com/api` | docs.keeperhub.com/api |
| Auth | `Authorization: Bearer kh_<key>`; OAuth for MCP browser flow | docs.keeperhub.com/api/authentication |
| Chainlink IDs are strings; `simulate` is JSON boolean | `"84532"`, `true` | CLAUDE.md hard rules |
| Condition-node edges need `sourceHandle: "true"/"false"` | — | CLAUDE.md hard rule 9 |
| `upstream_cold_start` retryable w/ `retryAfterSeconds`, same `idempotency_key` | — | docs.analysis.md §7 |
| Testnet USDC on Base Sepolia | Circle faucet, faucet.circle.com (select Base Sepolia) | circle.com/blog + faucet.circle.com |
| Testnet cbBTC / ETH on Base Sepolia | Coinbase Developer Platform faucet | coinbase.com/developer-platform/products/faucet |
| Morpho Blue canonical mainnet address | `0xBBBB...BBCAaFEB9aB4CAAN` (exact: `0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb`) — **mainnet value, DO NOT use on testnet without verification** | docs.morpho.org/developers/contracts/addresses |
| Morpho deployment artifacts repo | github.com/morpho-org/morpho-blue-deployment | GitHub |
| Morpho SDK family | `@morpho-org/blue-sdk` (+ blue-api, morpho-ts) — **exact package set to be confirmed in V-M1** | github.com/morpho-org |
| Chainlink Base Sepolia feeds exist for majors (ETH/USD, BTC/USD) | Verify exact feed addresses in V-M2 | docs.chain.link data feeds page |
| KH has Base Sepolia support + testnet is the ecosystem norm | — | KeeperHub ETHGlobal wrap; docs.keeperhub.com |

### 3.2 Verification steps (Phase 0 — run ALL before any feature code)

Each step writes its outputs to `build2/config/verified.json` (schema below) — this file is the single registry of provenance-checked constants. Commit it.

```jsonc
// build2/config/verified.json — shape
{
  "network": { "chainId": "84532", "name": "base-sepolia", "rpcUrl": "…", "verifiedBy": "V-N1" },
  "tokens": { "USDC": { "address": "0x…", "decimals": 6, "source": "faucet.circle.com mint tx 0x…" } },
  "morpho": { "blue": "0x…", "markets": [{ "id": "0x…", "collateral": "cbBTC", "loan": "USDC", "lltv": "910000000000000000" }], "oracle": "0x…", "irm": "0x…" },
  "keeperhub": { "restEndpointsConfirmed": ["POST /workflows", "…"], "actionTypesConfirmed": ["web3/check-balance", "…"] },
  "provenance": { "V-M1": { "command": "…", "resultDigest": "…", "timestamp": "…" } }
}
```

**V-K1 — KeeperHub tool surface.** In Claude Code with the KeeperHub MCP connected: run `tools_documentation`, then `list_action_schemas` (capture the FULL list), `get_wallet_integration`, `list_workflows`, `kh chain list` (CLI). DoD: wallet integration confirmed; Base Sepolia (`84532`) listed; dump of all action types saved to `build2/config/action-schemas.json`. This dump is the composer's whitelist — no action type outside it may ever appear in a generated workflow.

**V-K2 — REST endpoints.** Confirm against https://docs.keeperhub.com/api (fetch, don't assume) the exact paths + request shapes for: create workflow, validate workflow, execute workflow, get execution, get execution status, execution logs, direct execution (transfer/contract-call + status). Record exact paths in `verified.json`. If REST lacks `validate` or schema listing, mark MCP-only and adjust Phase 2 (composer uses MCP-dumped schemas from V-K1 instead).

**V-M1 — Morpho on Base Sepolia.** Check docs.morpho.org/developers/contracts/addresses and the `morpho-blue-deployment` repo for a Base Sepolia (84532) deployment. Then scan onchain via the Base Sepolia RPC (`cast call 0xbbbb…BBCCaaFEB9aB4CAAN` — the canonical address from V-M1 source — or query the Morpho API for chain 84532 markets). Decision tree:
- **T0: Morpho Blue exists on Base Sepolia AND has ≥1 market with our faucet tokens (USDC/cbBTC) and non-trivial liquidity** → use it. Record market IDs.
- **T1: contract absent or no viable market** → deterministically deploy canonical MorphoBlue on Base Sepolia using the official deployment artifacts (the canonical address is CREATE2-deterministic; follow the repo's deployment procedure exactly), then create our own market permissionlessly: loan token = faucet USDC, collateral = faucet cbBTC (or ETH-wrapper if cbBTC faucet is dry), oracle = Chainlink feed adapter or Morpho oracle factory instance, IRM = Morpho IRM factory default, LLTV = 91% (0.91e18, ~ matches cbBTC/USDC risk on mainnet). We supply BOTH sides (see §8) so "liquidity" is ours.
- **T2: Base Sepolia blocked entirely** (e.g., no Chainlink feed + oracle factory fails) → fall back to Ethereum Sepolia `11155111` and repeat T0/T1 there. Do not consider mainnet under any circumstances.
- Infra deploys in T1 are the ONLY sanctioned non-KeeperHub writes (one-time setup; KeeperHub has no contract-deployment surface). They happen in a scripted `packages/infra/scripts/deploy-testnet.ts`, executed once, with output recorded in `verified.json`. Every RUNTIME write after setup goes through KeeperHub, no exceptions.

**V-M2 — Oracles.** If T1: fetch the Chainlink Base Sepolia feed address for the chosen pair from docs.chain.link (data feeds → Base Sepolia). If no feed is workable, use Morpho's oracle factory minimal adapter per the deployment repo's documented flow. Record address + heartbeat + deviation params. Note: stale testnet feeds are EXPECTED; the product never depends on price movement (§8 breach modes).

**V-N1 — RPC.** Pick a public Base Sepolia RPC (from Chainlist or Base docs), verify with `cast block-number`. Record. (Reads use viem + this RPC; writes always KH.)

**V-F1 — Faucets.** Fund the KH org wallet + the adversary wallet from faucet.circle.com (USDC + ETH) and the Coinbase faucet (cbBTC, ETH). DoD: balances visible via KH `web3/check-balance` and in the app.

**V-T1 — Notification.** Run KeeperHub `test_notification` for Telegram (or Discord). Record which channel works; alerts use it.

### 3.3 Runtime truth sources (always authoritative over any doc)

- Action types → `build2/config/action-schemas.json` (V-K1 dump), refreshed by `pnpm sync:schemas` (an MCP script) whenever KeeperHub changes.
- Addresses/markets → `build2/config/verified.json`.
- Workflow validity → KeeperHub `validate_workflow` / REST validate — the composer's output is NEVER trusted locally; it is only accepted after a server-side validate call passes.

---

## 4. System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ build2/ (pnpm + turbo monorepo, TypeScript everywhere)             │
│                                                                    │
│  apps/web          Next.js 15 App Router — UI + API route handlers │
│  apps/worker       long-running Node process (tsx) — watcher,      │
│                    execution supervisor, reconciler                │
│                                                                    │
│  packages/risk     PURE TS: Morpho position math, ratio vs LLTV,   │
│                    breach detection, stress simulator. Zero I/O.   │
│  packages/policy   PURE TS: Zod policy schemas, caps enforcement,  │
│                    action allowlists                               │
│  packages/kh       KeeperHub client: REST wrapper + MCP schema     │
│                    sync + workflow-graph builder (typed DAG)       │
│  packages/agent    Composer + Critic (@anthropic-ai/sdk)           │
│  packages/db       Prisma + SQLite: users, positions cache,        │
│                    policies, plans, runs, run_steps, alerts        │
│  packages/infra    deploy-testnet.ts (T1 only), faucet scripts,    │
│                    env + verified.json loader                      │
└────────────────────────────────────────────────────────────────────┘
        │ reads (viem, public RPC)                 │ writes (ALWAYS)
        ▼                                          ▼
  Morpho Blue @ Base Sepolia            KeeperHub REST/MCP
  (positions, markets, oracle)          (validate → create → execute
                                         → status → logs → notify)
```

### 4.1 Why this shape

- **Monorepo, one language:** the executing agent never context-switches; shared types flow from `packages/risk` into web, worker, and agent.
- **`packages/risk` and `packages/policy` are pure:** 100% unit-testable, no mocks of external systems needed — this is where the 100+ test target is cheaply met.
- **Two processes, one DB:** web renders; worker owns time (polling, execution supervision, reconciliation). No cron service, no queue infra — a 4-day-compatible shape.
- **SQLite:** zero ops, file-committed for demo portability. Prisma for typed access.

### 4.2 Data model (Prisma schema — authoritative)

```prisma
model User        { id, khOrgId, telegramChatId?, createdAt }
model Wallet      { id, userId, address, role: "guardian" | "adversary", createdAt }
model Market      { id (morpho market id), loanToken, collateralToken, lltv (string, wei), oracle, irm, chainId }
model Position    { id, marketId, walletAddress, borrowShares, collateralShares, snapshotAt }
model Policy      { id, positionId, triggerRatioPct (e.g. 110 = 110% of LLTV), maxSpendUsd, allowedActions String[], slippageBps, status: "draft"|"armed"|"paused"|"needs_attention", circuitBreakerMaxRunsPerDay, createdAt, armedAt }
model Plan        { id, policyId, workflowJson (full KH workflow), rationale (composer explanation), planOptions Json (A/B comparison), criticVerdict Json, simulateResult Json, status: "proposed"|"criticized"|"approved"|"rejected"|"superseded", approvedAt }
model Guard       { id, policyId, planId, khWorkflowId, khIdempotencyKey, status: "armed"|"fired"|"disabled", createdAt }
model Run         { id, guardId, khExecutionId, trigger: "schedule"|"manual"|"breach", status: "pending"|"running"|"succeeded"|"failed"|"fallback", startedAt, txHashes String[], costUsd, logsJson Json, beforeSnapshot Json, afterSnapshot Json, reconciledAt? }
model Alert       { id, runId?, level, channel, payload Json, sentAt }
model Heartbeat   { id, component ("watcher"|"kh-client"|"reconciler"), lastTickAt, detail Json }
```

### 4.3 Runtime flows

**Flow A — Onboarding & plan creation (policy time; LLM active):**
1. Web: user opens app → worker-synced positions render (reads via viem; `web3/check-balance`-style KH read actions used where an equivalent exists — confirm during V-K1 which read actions to mirror).
2. User starts Guard Wizard → picks position → sets policy (packages/policy validates, Zod).
3. `POST /api/plans` → backend: builds a **position + market + policy context packet** → Composer (`packages/agent`) returns `{ workflow: WorkflowGraph, rationale, options[] }` — workflow built via `packages/kh` typed builder, nodes constrained to `action-schemas.json` whitelist.
4. Critic runs on the same context packet + composer output → `{ verdict: approve|reject, findings[] }`. Reject → recompose (max 2 loops) → surface to user with findings either way.
5. `POST /api/plans/:id/simulate` → KH simulate/validate (`simulate: true` on the action leg, `validate_workflow` on the graph). Result stored, shown as dry-run diff.
6. User approves → backend: `create_workflow` (idempotency key = plan id) → `Guard` row armed → policy `armed`.

**Flow B — Watch & fire (execution time; ZERO LLM):**
1. Worker watcher ticks every 30s (configurable): for each armed guard → read position via viem → `packages/risk.breachDetected(position, market, policy)` → persist `Position` snapshot.
2. On breach: `execute_workflow(guard.khWorkflowId, idempotencyKey = runId)` via KH REST → poll `get_execution_status` (bounded backoff, 2s→30s, cap 15min) → `get_execution` for `transactionHashes` + logs → store `Run` (succeeded/failed) → after-snapshot → reconcile (§6.4) → alert via Telegram (KH `test_notification`-verified channel; notification ALSO embedded as a KH workflow Telegram node where the template supports it).
3. Fallback branch: workflow's own condition node checks buffer sufficiency — if insufficient, executes secondary action (e.g., repay-with-buffer instead of top-up). If the whole run fails: policy → `needs_attention`, alert sent, circuit breaker incremented.

**Flow C — Stress Lab:** pure client-side/worker computation using `packages/risk` stress functions (no chain writes): slider over collateral-drop %, output ratio curve + "guard fires here" marker + projected post-save ratio.

**Flow D — Breach drill (demo, and an honest product feature):** an authenticated "Simulate stress" button executes the adversary withdrawal THROUGH KeeperHub (`web3/write-contract` calling Morpho withdrawCollateral on the borrower wallet — adversary wallet is a second KH org wallet or the same wallet acting as borrower, per §1.1), inducing a real breach that Flow B then catches. This is the demo's climax and a real "chaos test" feature.

---

## 5. Backend Specification

### 5.1 `packages/kh` — KeeperHub client (the ONLY module allowed to call KH)

- REST client (fetch wrapper): auth header from `KEEPERHUB_API_KEY` env; base from `verified.json`; endpoints per V-K2 confirmation. Timeouts: 30s default; execution-status polling loop internal.
- **Retry policy:** on HTTP 5xx / network error / `upstream_cold_start`: retry ≤3 with backoff respecting `retryAfterSeconds`; ALL mutations idempotent (`idempotency_key` param on create/execute; derive keys deterministically: `moat:{planId}` / `moat:{runId}`).
- **Workflow graph builder:** typed API — `graph().trigger("schedule", cron).read(...).cond(..., {true: […], false: […]}).action("morpho/supply", {...}).notify("telegram", {...}).build()` — that GUARANTEES: chainId strings, `simulate` boolean, condition edges carry `sourceHandle`, template refs `{{@nodeId:Label.field}}` per docs.keeperhub.com/workflows/templating. Compile-time + runtime Zod validation of the built graph against `action-schemas.json`.
- `sync:schemas` script: MCP-driven dump → `config/action-schemas.json` (committed).

### 5.2 `packages/agent` — Composer & Critic

- SDK: `@anthropic-ai/sdk`. **The implementing agent must load the `claude-api` skill before writing this package** (prompt caching, current model IDs, structured output patterns).
- Models: composer `claude-opus-4-7`, critic `claude-sonnet-4-6`. Model IDs live in env (`COMPOSER_MODEL`, `CRITIC_MODEL`) with these defaults.
- **Composer input (deterministic, no free-text chain data):** JSON context packet = position snapshot, market params (LLTV, oracle meta), policy, buffer balances, action-schemas whitelist, gas context, three or fewer candidate recipes enumerated by `packages/risk` (top-up / repay / withdraw-and-repay, each pre-costed).
- **Composer output contract:** strict JSON via tool-use schema: `{ chosenOption, rationalePlain (≤280 chars, user-facing), workflow (WorkflowGraph from packages/kh builder shape), alternatives: [{name, costUsd, effectOnRatioPct}] }`. Invalid JSON → retry once → fail visibly.
- **Critic input:** same context packet + composer output. **Critic is adversarial:** system prompt frames it as an independent risk reviewer hunting for math errors, slippage > policy cap, wrong-action-vs-policy, oracle staleness mishandling, LLTV edge cases, template-ref typos. Output: `{ verdict: "approve"|"reject", findings: [{severity, what, why}] }`. Reject → one recompose loop (max), then surface both to the user with a "agent disagreement" banner — never auto-approve past a critic rejection.
- **Prompt caching:** context packet + schema whitelist are cache-eligible static blocks; structure prompts to hit the cache (system + schemas cached, position data last).
- **No LLM anywhere else.** Worker, watcher, execution: pure code.

### 5.3 `apps/worker` — three loops

1. **Watcher** (30s tick): sync positions of armed guards; breach check; heartbeat row per tick.
2. **Execution supervisor**: owns run state machine `pending → running → succeeded | failed | fallback`; polls KH; enforces 15-min cap → marks failed + alerts.
3. **Reconciler** (5-min tick): for latest run per guard — re-read onchain position, verify expected effect (ratio improved ≥ plan's projected delta × 0.8), flip `reconciledAt`, else alert `needs_attention`. Also enforces circuit breaker: > `circuitBreakerMaxRunsPerDay` fires → auto-pause policy + alert.

### 5.4 `apps/web` — API routes (App Router route handlers)

`POST /api/plans` (compose+critic), `POST /api/plans/:id/simulate`, `POST /api/plans/:id/approve` (validate→create→arm), `POST /api/guards/:id/pause`, `POST /api/guards/:id/drill` (Flow D adversary withdrawal via KH), `GET /api/positions`, `GET /api/runs`, `GET /api/health` (heartbeats + KH ping). All writes audit-logged to `Alert`.

### 5.5 Configuration & env

`build2/.env` (never committed): `KEEPERHUB_API_KEY`, `COMPOSER_MODEL`, `CRITIC_MODEL`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `RPC_URL_84532`, `TELEGRAM_*` (if needed by KH notification config), `CHAIN_ALLOWLIST="84532,11155111"` (Base Sepolia default; Sepolia present only as the §3.2 V-M2 T2 fallback).
**Hard guard:** `packages/infra` asserts `chainId ∈ CHAIN_ALLOWLIST` before every KH mutation and refuses anything else — a structural mainnet-impossibility, not a convention.

---

## 6. Reliability & Observability (rubric line 3 — build to demo these)

| Concern | Mechanism | How it's shown |
|---|---|---|
| Nonce/gas/stuck-tx | KeeperHub native (state this; don't rebuild) | Architecture doc + run logs showing KH executor fields |
| Double-fire | Idempotency keys on create+execute; guard status gate (`armed`→`fired` single-transition w/ DB transaction) | Test: concurrent breach events → exactly 1 run |
| Partial failure | Workflow condition node: buffer check → primary vs fallback action branch | Drill video G7 |
| Run failure | Supervisor timeout → `failed`, alert, `needs_attention`, circuit breaker | Injected-failure test |
| Reconciliation drift | Reconciler effect verification | Run detail "Verified effect" badge |
| Watcher death | Heartbeats; web `/api/health` shows component ages; UI banner if any component > 3× interval | Status strip in UI footer |
| Cold start | KH `upstream_cold_start` retry policy (§5.1) | Unit test w/ mocked 503 |
| Oracle staleness | `packages/risk` flags stale feed (heartbeat/deviation from V-M2 params); critic treats stale-oracle plans as reject-worthy | Stale-oracle unit test + UI badge |

**Audit trail policy:** every Run stores the complete KH `get_execution` JSON + logs verbatim (`logsJson`). UI renders it as the run timeline. Nothing is summarized at the expense of the raw record.

---

## 7. Frontend & UX Specification

**Design stance:** UX is the product; visual skin is replaceable. Tailwind + shadcn/ui, dark-first (DeFi-native), system font stack, 8-pt spacing. Every screen below is a required deliverable with its states enumerated. No screen ships without: loading (skeleton), empty, error, and success states.

### 7.1 UX principles (apply everywhere)

1. **Never hide the chain.** Every number that matters has a tx-hash link and a timestamp. Every agent claim has a rationale string next to it.
2. **Show the determinism line.** Plans are labeled "AI-composed" with a visible badge; armed guards are labeled "Locked workflow — no AI at execution." Users (and judges) must SEE the policy-time vs execution-time split.
3. **Dollars, not jargon.** "Danger line" for LLTV ratio; ratios shown as % of danger line with color zones: **Safe (green, >140%) / Warning (amber, 115–140%) / Danger (red, <115%)**; LLTV-proximate thresholds configurable per policy.
4. **Every action reversible pre-arm.** Nothing onchain before "Approve & Arm." Approve button shows the exact workflow summary (nodes count, actions, caps).
5. **Failure is a first-class state.** `needs_attention` states have explicit "What happened / What Moat did / What you can do" copy blocks.

### 7.2 Screens

**S1 Landing/Connect.** One-line value prop: "Liquidation protection that plans with AI and executes without it." Live counters: "runs executed", "testnet tx count". CTA: Enter App. (No wallet-connect flow — org-session login, per Non-Goals.)

**S2 Dashboard.** Grid of position cards. Each card: market pair (cbBTC/USDC), **ratio gauge** (arc w/ green/amber/red zones, needle at current ratio, marker at policy trigger line), borrowed/supplied amounts, oracle badge (source + freshness), guard status chip (`Unguarded` CTA / `Armed` with next-trigger distance), last-run strip (time, action, tx link). Header: network badge "Base Sepolia", buffer balance summary, system-heartbeat strip. Empty state: illustration + "Open a demo position" (setup script link). Loading: skeleton cards.

**S3 Guard Wizard (3 steps + review).**
- Step 1 *Position*: frozen snapshot of position + market card; freshness timestamp.
- Step 2 *Policy*: trigger-threshold slider snapped to zones (default 110% of danger line) with live "time-to-danger at current drift" hint; budget cap input (testnet USD) with hard ceiling = buffer balance; action toggles (Top-up / Repay / Withdraw-and-repay) each with one-line plain-English effect; slippage select (10/50/100 bps); circuit breaker (max runs/day, default 3).
- Step 3 *Plan review*: composer output card — chosen action, plain rationale (≤280 chars), cost vs effect table (chosen vs alternatives), **dry-run diff panel** (before/after ratio bars, simulated result line from KH), failure-branch list ("If buffer insufficient → repay instead"), critic verdict chip (Passed / Rejected w/ findings — if rejected, both plans shown side-by-side, user may still approve with warning, honoring human-over-agent). CTA: "Approve & Arm."
- Post-arm confirmation: runbook strip "Watching every 30s · Locked workflow ID … · Pause anytime."

**S4 Position Detail.** Full market table (loan, collateral, LLTV, oracle, IRM), ratio history sparkline (from Position snapshots), active guard summary, run list for this position, Stress Lab embed.

**S5 Runs / Audit Trail.** Master timeline (all positions) + per-run detail page: step-by-step timeline (trigger → read → condition → [swap] → action → notify), each step: status icon, node label, duration, cost, tx hash link (Basescan Sepolia), expandable raw KH log JSON; before/after snapshot diff; "Verified effect" reconciliation badge; export JSON button.

**S6 Stress Lab.** Slider "collateral drop 0–50%" → ratio curve chart with trigger-line intersection marked "Guard fires here" → projected post-save ratio → projected loss-without-guard (bonus % × collateral) vs cost-with-guard comparison. Pure simulation (`packages/risk`), zero writes. This screen doubles as the demo's educational anchor.

**S7 Drill Console.** "Run breach drill" button (Flow D) with amount selector → executes KH adversary withdrawal → live status → auto-links the resulting guard Run. Copy frame: "Chaos-test your own protection. The adversary is also onchain."

**S8 Settings.** Alerts channel status (from V-T1), KH org status (`get_wallet_integration` mirror), schema-sync timestamp, chain allowlist display, environment banner ("TESTNET — value is simulated").

**Global chrome:** top bar product name + network badge + heartbeats; bottom bar: links (tx explorer, KH workflow, audit export). Responsive ≥375px.

### 7.3 Copy tone

Calm, operational, zero hype. Numbers everywhere. Example rationale copy: "Swap 300 test USDC → cbBTC (CoW route est.) and supply as collateral. Cost ≈ $0.42. Moves you from 108% → 131% of the danger line. Repay instead was $1.10 for the same effect." Error copy always includes the KH error code verbatim + one plain sentence.

---

## 8. Testnet Reality Plan (design FOR the constraints)

1. **We are the liquidity.** Testnet Morpho markets are thin or empty. Whatever T0/T1 yields, Moat's own wallets supply the borrow side (deposit USDC to the market from the guardian/adversary wallet) so the user position can borrow. This is setup, scripted in `packages/infra`.
2. **Breach = collateral withdrawal, never oracle movement.** Testnet Chainlink feeds update irregularly; depending on price movement makes demos flaky. The deterministic breach path: borrower withdraws collateral (onchain, via KH) → ratio crosses trigger → guard fires. Oracle data still displayed (freshness badge) — honest about testnet staleness.
3. **Gas is negligible but must be shown.** Run cost breakdowns display gas (from KH execution data) even when ~$0.001 — it proves the observability pipeline.
4. **Faucet dependency hygiene.** All faucet steps scripted with links in README; if a faucet is dry, V-F1 fallbacks: Coinbase faucet → Chainlink faucet (ETH only) → L2Faucet. Tokens chosen to guarantee at least one collateral + one loan token (USDC + cbBTC, else USDC + WETH-styled wrapper from T1 market creation).
5. **Value-movement proof on testnet:** ≥3 tx hashes across ≥2 runs (success + fallback path), each linked from the Runs screen; submission form states "Base Sepolia testnet" explicitly and honestly (mainnet = stronger but out of scope by choice — frame as discipline, not limitation).

---

## 9. Agent (LLM) Safety Envelope

- Composer/critic outputs NEVER reach the chain directly — they only produce/evaluate workflow JSON that must pass: Zod graph validation → action whitelist check → `validate_workflow` (KH) → user approval. Four gates, three of them deterministic.
- Policy caps are enforced in the workflow itself (condition nodes check buffer vs `maxSpendUsd` template refs) — not only in code — so even a malformed plan cannot overspend the approved buffer.
- Circuit breaker: max N runs/day/policy (default 3), then auto-pause + alert. Demonstrated in drill video.
- Adversary actions (drills) are separately permissioned (KH org wallet #2 or scoped key) and amount-capped in UI.

---

## 10. Testing Specification (target: 100+ tests, CI-green as submission evidence)

| Layer | Suites | Key cases |
|---|---|---|
| `packages/risk` | ratio math vs LLTV (incl. share↔asset conversions), breach detection boundaries (trigger at exactly 110%), stress curves, oracle staleness flag | property-based: ratio monotonicity under collateral withdrawal |
| `packages/policy` | Zod validation, cap enforcement, allowlist | invalid action rejected |
| `packages/kh` | graph builder invariants: chainId string, simulate boolean, condition sourceHandle, template-ref format; retry logic w/ mocked `upstream_cold_start` + `retryAfterSeconds`; idempotency-key derivation | malformed graph throws before any HTTP |
| `packages/agent` | composer JSON contract (mocked LLM), critic rejection on poisoned plans (slippage violation, wrong action vs policy, stale oracle), recompose loop bound | poisoned-plan fixtures MUST be rejected |
| `apps/worker` | single-fire concurrency, supervisor timeout → failed, reconciler drift → needs_attention, circuit breaker | two simultaneous breach events → one Run |
| E2E (`apps/worker` scripts) | scripted full loop against Base Sepolia: fund → position → guard arm → drill withdrawal → guard fire → assert tx + reconciliation | produces the submission's tx hashes |

Test runner: vitest. CI: GitHub Actions on push (node 22, pnpm). CI badge in README = judge-visible hygiene.

---

## 11. Repo & DX Requirements (rubric line 5)

`build2/README.md` must contain, in order: what it is (3 lines) → architecture diagram (ASCII) → verified-facts philosophy + `verified.json` provenance explanation → setup (env, `pnpm i`, db push, Phase-0 verifications, faucet links) → run (web, worker, sync:schemas) → demo script (the exact 10-minute flow) → test/CI → candid "known limitations" (copied from product.md §7, adapted: everything is testnet; single-position self-guard; on-behalf stretch status; marketplace listing status). `docs/ARCHITECTURE.md` expands §4–§6. Every package has its own README section. Lint: `biome` or `eslint`+`prettier` — pick once, enforce in CI.

---

## 12. Submission Package (main BUIDL)

1. **Source:** public repo (build2 contents at root, this docs/ folder referenced or copied into `docs/`).
2. **Demo video (≤5 min, script order):** threat framing (15s: numbers from product.md §2c) → dashboard → wizard policy → agent plan + critic + dry-run diff → approve & arm → drill console breach (through KH) → guard fires → run timeline with tx hashes → failure-branch demo → stress lab → architecture recap (30s: the determinism line).
3. **Tx links:** ≥3 testnet tx hashes (success run, fallback-branch run, drill withdrawal).
4. **Form answers (draft now, finalize at submission):** project = Morpho (named, specific: LLTV math, market params, Blue SDK); surfaces = MCP + agent-authored workflows + simulate/dry-run + audit trail + DeFi plugins (morpho/web3/telegram) + schedule triggers + CLI (setup scripts) + marketplace/x402 (if G9 lands); testnet = Base Sepolia, candid why; what breaks = honest list from §7/Risks incl. testnet liquidity caveats; contact per user's preference.

---

## 13. Bounty BUIDL (separate BUIDL, separate directory)

- Location: `/Users/shreyas/Desktop/keeperhub/bounty` = clone of fork of `github.com/keeperhub/keeperhub`, branch `feat/morpho-position-risk-actions`.
- **Day-1 recon (timeboxed 90 min):** read the repo's plugin/action architecture; identify the smallest mergeable unit. Preferred candidates in order: (a) `morpho` position-read action exposing ratio-vs-LLTV + market metadata (new connector+action — two named bounty categories), (b) generic "risk-ratio check" trigger/action node, (c) DX improvement discovered during Phase 0 (docs gaps count — KeeperHub paid feedback bounties at ETHGlobal for exactly this; mergeable DX/doc PRs are in-scope per "developer experience improvement").
- Rules: follow repo conventions exactly, tests required (bounty rubric names "code quality and tests"), CI green, no scope creep, PR description links Moat as motivation. If recon shows plugin surface can't absorb this in the window → ship (c) instead; if even (c) is unclear → drop bounty without touching main-track scope (decision point: end of Day 2).
- Separate DoraHacks BUIDL entry (rules require it), linking the PR.

---

## 14. Build Sequence (executing agent: follow in order; each phase has a Definition of Done gate — do not proceed past a red gate)

**Phase 0 — Foundations & verification (half day).**
Scaffold monorepo (pnpm+turbo, TS strict, biome, vitest, CI stub). Then run ALL of §3.2 (V-K1…V-F1, V-T1). Write `verified.json` + `action-schemas.json`. Set up KH org, wallets, fund faucets.
DoD: `pnpm test` green (scaffold-level); `verified.json` complete with provenance; CI running; both wallets funded (screenshot in `docs/journal/`).

**Phase 1 — Risk core (half day).** `packages/risk` + `packages/policy` complete + tested (§10 rows 1–2). Market/position sync from RPC into DB.
DoD: position of the funded wallet reads through `packages/risk` and produces correct ratio vs. LLTV (hand-verified against a manual calculation shown in test comments).

**Phase 2 — KeeperHub client + graph builder (half day).** `packages/kh` per §5.1 incl. `sync:schemas`. Validate a hand-built sample workflow through `validate_workflow` and create it (disabled).
DoD: sample workflow ID exists in KH; retry tests green.

**Phase 3 — Guard loop without AI (half day).** Watcher + supervisor + a HAND-CODED default plan (top-up) armed on the real testnet position; drill withdrawal via KH; full Flow B working end-to-end; Runs persisted w/ logs.
DoD: tx hash #1 exists; reconciliation badge shows verified effect.

**Phase 4 — Composer & Critic (half day).** `packages/agent` (load `claude-api` skill first); wire Flow A; critic poison tests.
DoD: wizard produces agent plan → validate passes → approve → arm, replacing hand-coded plan; poison tests green.

**Phase 5 — Web UX full build (1 day).** All screens §7.2 with all states; Runs timeline from real data.
DoD: click-through of S1→S8 with zero console errors; empty/error/loading states verified by toggling worker off.

**Phase 6 — Hardening (half day).** Failure-path drills (insufficient buffer → fallback run → tx hash #2; supervisor-timeout injection; circuit breaker); heartbeats; 100+ tests; README + ARCHITECTURE docs.
DoD: §10 table fully green; fallback-run tx hash #2 (+#3) captured.

**Phase 7 — Extras + submission (half day).** Stress Lab polish; marketplace listing attempt (2h timebox); demo video; form answers; repo public; submit. Bounty PR in parallel from Day 2 per §13.
DoD: all three submission artifacts (§12) complete and submitted ≥12h before deadline.

**Standing rule across all phases:** at every DoD gate, commit; on any BLOCKED verification, stop that thread and surface the question — never guess, never hardcode unverified constants, never touch mainnet.

---

## 15. Risk Register (build-time)

| Risk | Likelihood | Mitigation |
|---|---|---|
| No viable Morpho testnet market (T0 fails) | Medium | T1 deterministic deploy (scripted, official artifacts); T2 Sepolia fallback |
| Chainlink testnet feed absent for chosen pair | Medium | Oracle factory adapter per deployment repo; product never depends on price movement (§8.2) |
| KH REST shape differs from analysis.md | Low | V-K2 verifies against live docs before any code |
| Faucet dryness | Low | Multi-faucet fallback (§8.4) |
| Composer produces non-validating graphs | Medium | Typed builder constrains output; validate_workflow gate; recompose loop; fallback to hand-coded default plan keeps demo alive |
| Scope overrun on UX | Medium | Screens are shadcn-composed; §7 states minimum states; polish defer list (theming, animations) explicit |
| Marketplace/x402 listing friction | Medium | 2h timebox; it's G9, not a gate |

---

## 16. Explicitly Open Items (resolve during Phase 0/1; none block starting)

1. On-behalf (protect another wallet's position) — stretch, post-v1 (§1.1).
2. Telegram vs. Discord alert channel — V-T1 decides.
3. Whether KH workflow Telegram notification nodes are usable inside custom graphs — confirmed during V-K1 from schema dump; else worker-side send (KH-verified channel config reused).
4. cbBTC faucet availability — V-F1; fallback collateral token per §8.4.
5. Marketplace listing mechanics — G9 timebox decision.
