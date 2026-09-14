# Moat — Agent-Guarded Liquidation Protection for Morpho

**Hackathon:** KeeperHub — The Agent Economy Hackathon (DoraHacks), Sep 6–18, 2026
**Status:** Building in `build2/` (testnet-only). **Live pickup: `docs/CONTEXT.md`.** Dashboard: `docs/STATUS.md`.
**Verdict:** Build this. Network of record is Base Sepolia `"84532"`, not mainnet `"8453"`.

---

## ⚠️ Deadline Reality Check

Submissions close **Sep 18, 2026** (confirmed via [DoraHacks newsletter](https://dorahacks.io/blog/news/dora-hackathons) and [DevConnect hub](https://devconnectplatform.com/c/web3-hackathon-hub)). Today is Sep 14. **We have 4 days, not "a lot of time."**

Implication: full product vision below stays intact, but the build plan (§9) is phased so a complete, mainnet-proven core ships by Sep 17 with buffer. Everything beyond the core is post-submission roadmap.

---

## 1. Executive Summary

**Moat** is an agent-guarded liquidation protection service for **Morpho** (and later Aave V3) borrowers on **Base and Ethereum mainnet**. A user connects a wallet with a leveraged or borrowed position, sets a protection policy once, and an LLM composer agent designs a deterministic protection workflow on KeeperHub — collateral top-up, debt repayment, partial unwind, or swap-then-repay — which a critic agent red-teams, the user reviews as a dry-run diff, and then KeeperHub arms and executes autonomously whenever the position's risk ratio breaches the policy threshold. Every save produces a transaction hash and a full audit trail surfaced in the Moat dashboard.

The one-line thesis: **the agent plans, the human approves once, the chain executes deterministically forever after.** That is not just a product — it is KeeperHub's entire founding narrative ("nothing is inferred at execution time") incarnate as a consumer product with quantifiable dollar value per user.

**Why it can win:** it hits all five judging criteria with hard evidence (§6), targets a live $10B TVL protocol with a documented $238M/week liquidation catastrophe and zero incumbent protection tooling (§3), rides a once-in-a-cycle keeper-market vacuum (OpenZeppelin Defender sunset July 1, 2026; Gelato Web3 Functions dead March 31, 2026), and uses every KeeperHub surface the judges ask about — MCP, audit trail, simulate, DeFi plugins, event/schedule triggers, marketplace + x402 monetization.

**Why it is a real product, not a demo:** borrowers on Morpho demonstrably lose 5–15% of seized collateral to liquidation bonuses. DeFi Saver proved willingness-to-pay at 0.25% per save on Ethereum mainnet lending — but does not cover Morpho, does not run on Base at depth, exposes no API, and cannot be driven by agents. Moat undercuts at ~0.10% per save and lists its guard workflow on the KeeperHub marketplace for per-execution x402 purchase. Users are acquirable on-chain today: every at-risk Morpho wallet is publicly scannable.

---

## 2. Research Foundation (what this is built on)

All claims below are sourced from live research conducted Sep 14, 2026. Full source list in §11.

### 2a. What the judges actually reward (from KeeperHub's own prior hackathon wrap)

KeeperHub's review of their ETHGlobal OpenAgents hackathon ([blog](https://www.keeperhub.com/blog/010-openagents-hackathon-wrap)) — same organizers, same taste — reveals the winning patterns:

| Winner | What it was | Why it won |
|---|---|---|
| **ZW.ARM** | Three-agent yield rotator **live on Base mainnet** (Aave/Compound/Morpho) | 450 real transactions, 98.4% decision quality, independent **critic agent**, real APY on real USDC |
| **Tradewise Agentlab** | Agent quoting Uniswap swaps paid via x402 USDC | **125 tests**, live deployment, detailed bug reports, novel reputation model |
| **Keeper-Gate** | Framework-agnostic SDK exposing KeeperHub to LangChain/ElizaOS | Reusable connector — but note: **multiple teams converged on this, and KeeperHub flagged it as a gap they intend to close themselves** |

Additional signals: of 180 projects reviewed, 30 were rejected as "shallow surface integrations"; judges **left prize slots unclaimed** rather than reward mediocrity; mainnet with real volume beat testnet demos.

**Meta-lessons:**
1. Mainnet + real transactions + real volume wins.
2. Executor agent + independent critic agent is a proven winning architecture.
3. Connector/SDK plays are now derivative — do not build one.
4. Tests and production hygiene are explicit tie-breakers.
5. A product that *demonstrates KeeperHub's core determinism thesis* is maximally aligned with the sponsor's self-image.

### 2b. The keeper market vacuum (timing tailwind)

- **OpenZeppelin Defender hosted service sunset July 1, 2026** ([sunset FAQ](https://www.openzeppelin.com/news/defender-sunset-faq)); open-sourced for self-host only. Active migration wave underway.
- **Gelato Web3 Functions discontinued March 31, 2026** ([Mimic migration post](https://mimic.fi/blog/gelato-web3-automation-is-ending-use-mimic)); Gelato pivoted to RaaS.
- **Chainlink Automation**: no execution-timing guarantee, skips during congestion when gas exceeds threshold, per-upkeep prepaid balances halt on underfunding. No agent semantics, no DeFi protocol knowledge ([economics docs](https://docs.chain.link/chainlink-automation/overview/automation-economics)).
- **ERC-4337 bundlers/paymasters**: gas plumbing only — no conditional logic, no retries across conditions, no audit trail at the strategy layer.

Two of three incumbent hosted automation platforms are shutting down **right now**, and none of them ever had agent semantics. This is a rare, documented market-timing opening.

### 2c. The Morpho liquidation catastrophe (the wedge)

- Morpho TVL crossed **$10B by April 2026** after the Coinbase integration ([eco.com](https://eco.com/support/en/articles/13064566-morpho-protocol-explained-2026)).
- **$238M liquidated on Morpho in the late-Jan/early-Feb 2026 downturn**; a single PT-reUSD 3% dip caused $36.4M of liquidations in isolation ([Steakhouse](https://kitchen.steakhouse.financial/p/238m-liquidations-of-onchain-lending)).
- Aave's record: **$429M liquidated Jan 31–Feb 5, 2025** ([Aave blog](https://aave.com/blog/historical-liquidations)); liquidator bonuses average **~5.2% of seized collateral** ([Pangea](https://blog.pangea.foundation/aaves-liquidators/)), ranging 5–15%.
- Scaled across Aave + Morpho, liquidation penalties plausibly total **$30–80M/year**, concentrated in crash weeks.
- **Protection incumbents:** DeFi Saver (0.25% per automated save, Ethereum-mainnet-centric, no Morpho, no public API, no agent control — [fees](https://defisaver.com/features/automation)); Instadapp Actions (tied to their smart account); karpatkey (managed DAO service). **Nobody covers Morpho at scale, nobody is agent-triggered, nobody ships cross-chain out of the box.** Morpho's own "pre-liquidations" is opt-in infra for liquidators, not a borrower protection product.

### 2d. Integration target assessment (the three named examples, verified)

| Project | State (Sep 2026) | Verdict as target |
|---|---|---|
| **Wayfinder** | Live, PROMPT token, Parallel team, Paths SDK with MCP support, pushed Sept 11 2026 | STRONG — but integration shape = connector (derivative risk, §4-C3) |
| **Daydreams** | Core repo stale 6+ months; org pivoted to lucid-agents commerce SDK; small community | OK — weak "real users" story |
| **Almanak** | $11.95M raised but token −80% post-TGE, tiny public community (61 GitHub stars) | WEAK — smallest user base |
| **Morpho** | $10B TVL, Coinbase-built on top, active ecosystem, massive documented borrower losses | **STRONG — chosen.** An "active protocol" explicitly qualifies per the brief ("with users, a deployed product or an active protocol behind it") |

Secondary named integrations that strengthen the "specificity" story: **Chainlink/Chronicle** (oracle reads via KeeperHub plugins), **CoW Swap / Aerodrome** (swap legs inside protection workflows), **Base** (primary network — Coinbase's cbBTC leveraged loops on Morpho are a flagship Base use case).

### 2e. The x402 landscape (why we use it, but don't lead with it)

x402 is now Linux-Foundation governed with real integration traction (119M+ cumulative txs on Base) but **~$0.21 average transaction value and significant wash activity** ([Chainalysis](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/), [WorkOS](https://workos.com/blog/x402-vs-stripe-mpp-how-to-choose-payment-infrastructure-for-ai-agents-and-mcp-tools-in-2026)). Pay-per-call agent marketplaces are commoditized; the unsolved layer is trust/escrow/verifiable delivery — but that is a two-sided market with a cold-start problem, which makes it a demo trap for a 4-day build (killed idea, §4-C2). **Decision: use x402 as Moat's monetization rail (marketplace listing, per-execution pricing) — a surface checkbox for the judges — not as the product itself.**

---

## 3. The Product

### 3.1 What Moat does

A borrower with a Morpho position (e.g., cbBTC collateral / USDC debt, or a PT-eETH leveraged loop) visits Moat, connects their wallet, and in under two minutes:

1. **Sees their live risk picture** — every Morpho Blue market position, per-market borrow/collateral ratio vs. LLTV, oracle source and freshness, liquidation price, time-to-liquidation estimate under configurable stress.
2. **Sets a protection policy** — trigger threshold (e.g., act when ratio ≤ 110% of LLTV), per-action spend caps, allowed action classes (top-up / repay / unwind / swap-first), slippage tolerance, priority asset ordering.
3. **Receives an agent-designed protection plan** — the composer agent reads the position, current gas, swap routes, and yields, then *composes a KeeperHub workflow* selecting the cheapest effective action and explaining why (e.g., "swap 300 USDC → cbBTC via CoW, supply as collateral: cost $0.42, moves ratio from 108%→131% of LLTV; repay alternative costs $1.10 for same effect").
4. **Reviews a dry-run diff** — the exact workflow, simulated (`simulate: true`), with before/after position state and failure branches visible. Edits or approves.
5. **Arms the guard** — the approved workflow is validated (`validate_workflow`), created with an `idempotency_key`, and enabled. From this moment, **no inference ever touches the execution path**.
6. **Gets protected** — a KeeperHub watcher (schedule/event trigger + oracle checks) fires the workflow on breach. The protection executes with KeeperHub's nonce management, smart gas estimation, private routing, and retries. The user gets a Telegram/Discord alert with the tx hash and a link to the full run audit trail in the Moat dashboard.

### 3.2 Architecture

```
[Morpho Blue positions — Base + Ethereum mainnet]
        │  (reads: KeeperHub web3/read-contract, blue-sdk)
        ▼
[Moat Watcher Service]
   • per-market ratio vs LLTV, oracle freshness
   • breach detection against user policy
        │
        ▼ (policy-time only — LLM never on hot path)
[Composer Agent]  ── composes KH workflow JSON from live action schemas
        │
        ▼
[Critic Agent]  ── red-teams plan: math, slippage, oracle staleness,
        │          LLTV edge cases, policy compliance; rejects → recompose
        ▼
[User Review UI]  ── simulate:true dry-run diff, caps, approve
        │
        ▼
[KeeperHub]  validate_workflow → create_workflow(idempotency_key) → armed
        │
        ▼  (hot path: zero inference, pure workflow)
[Trigger fires on breach]
   → read ratio → condition branch → [swap leg: CoW/Aerodrome if needed]
   → protection tx (supply collateral / repay / withdraw+repay)
   → get_execution → tx hash + logs
        │
        ▼
[Moat Dashboard + Telegram/Discord]  — full audit trail, per-run economics
```

**Key invariant:** LLM inference happens exactly once, at plan composition, behind a human approval gate. Everything after approval is deterministic KeeperHub workflow execution. This is the "agent composes → you review → that exact workflow executes" guarantee, and we say so in those words in the pitch because they are the sponsor's own words.

### 3.3 KeeperHub surfaces used (the form question, answered)

| Surface | How Moat uses it |
|---|---|
| MCP server | Session-time composition: `tools_documentation` → `list_action_schemas` → `search_protocol_actions` → `validate_workflow` → `create_workflow`; ops: `get_execution`, `get_execution_logs` |
| Agent-authored workflows | The entire product: LLM composes the protection DAG |
| Dry-run / simulate | Every plan shown to user pre-approval; every workflow's first execution step simulated |
| Audit trail | Run logs + tx hashes surfaced in dashboard; `get_execution_logs` powers the activity feed |
| DeFi plugins | Morpho supply/withdraw, Aave (v2 scope), CoW/Aerodrome/Uniswap swaps, Chainlink/Chronicle oracle reads, web3 read/write actions |
| Event + Schedule triggers | Watcher = KH trigger nodes (per-block/schedule + onchain oracle events) |
| Marketplace + x402/MPP | "Morpho Guard" workflow listed on the KH marketplace at per-execution price; agentic wallets of *other* agents/services pay x402 to run protection for their principals |
| Agentic wallet spend limits | Per-action caps enforced via spending limits — the safety story |
| CLI | `kh` for ops automation and CI smoke tests (bonus surface) |

Full marks on the surfaces checklist — including the two optional ones (x402/MPP, CLI) most submissions miss.

### 3.4 Monetization & business

- **Per-save fee: 0.10% of value moved** (vs. DeFi Saver's 0.25% anchor), capped per action. Value proposition is arithmetic: average liquidation bonus ~5.2% of seized collateral; if your breach would liquidate $10,000 of collateral, Moat acting early costs ~$10 versus ~$520+ lost to the liquidator. That is a 50x framing a borrower understands instantly.
- **Marketplace distribution:** list the guard workflow on KeeperHub's marketplace. Other agents (treasury bots, portfolio managers — the exact KeeperHub user base) pay per execution via x402 to protect their principals' positions. Moat becomes sellable infrastructure, not just a UI.
- **TAM honesty:** liquidation penalties of $30–80M/yr across Aave+Morpho are the *loss pool*; Moat monetizes prevention of a share of it, plus the much larger pool of risk-averse borrowers who avoid leverage entirely because they fear liquidation (expansion argument, not counted in TAM).
- **GTM:** (1) on-chain targeting — every at-risk Morpho wallet (ratio ≤ 130% of LLTV) is publicly scannable; gasless invite + free first save; (2) Base/Coinbase and Morpho Discord/Telegram communities; (3) the Defender/Gelato refugee wave searching for automation homes; (4) KeeperHub's own marketplace as a channel to agent operators.

### 3.5 Product roadmap (post-hackathon)

- **v1 (hackathon):** Morpho Blue on Base mainnet. Position dashboard, policy engine, composer+critic, arm-and-execute, audit trail, marketplace listing. Real funded demo positions.
- **v1.5 (2 weeks post):** Ethereum mainnet, Aave V3, multi-position portfolios, stress-simulator ("what if ETH −20%"), weekly risk reports.
- **v2 (1–2 months):** Morpho MetaMorpho vault positions and curator tooling (curators managing $B vaults are a B2B wedge with ~dozens of high-value users); intent-based "protection SLAs" for treasuries (agent proposes, multisig approves, KeeperHub executes).
- **v3:** hedge-actions (perp shorts via Hyperliquid plugin as delta-hedge alternative to unwinding), cross-chain bridging legs (LayerZero plugin) for collateral mobility.

---

## 4. Idea Funnel — what was considered, killed, and why

Eight candidates generated and attacked. Killing rationale recorded so we don't relitigate.

**C1. Moat (Morpho liquidation protection).** Survived every attack (§5). Chosen.

**C2. Escrow-verified agent labor market** ("agents hire agents; x402 payment released on verified delivery via KH audit trail"). Strongest *narrative* — the trust/escrow gap is corroborated by IETF drafts and arbitration bodies, and no one occupies it. Killed for the main track: two-sided cold start, no real users in 4 days, counterparty (Daydreams/lucid) too small, and "marketplace" submissions are a genre judges see dozens of. Parked as future build; its escrow-release-verified-by-KH-audit pattern may resurface inside Moat v3 SLAs.

**C3. KeeperHub-as-Wayfinder-Path** (publish a reliability Path so Wayfinder Shells route execution through KH). Strong named target, but the shape is a connector — exactly the Keeper-Gate pattern judges already saw, flagged as a gap *they intend to close themselves*. Derivative. Killed. (Moat's workflows can later be exposed as a Wayfinder Path — noted as distribution, not core.)

**C4. ElizaOS/Virtuals plugin ("bring deterministic execution to the biggest agent frameworks").** Same connector problem as C3, at larger scale. Killed.

**C5. Autonomous yield rotator with critic agent.** This *won* ETHGlobal (ZW.ARM). Rebuilding a winner from six months ago = guaranteed derivative. Killed.

**C6. DAO treasury copilot** (agent proposes, multisig approves, KH executes). Real willingness-to-pay, but sales cycles are months long; no demonstrable "live project user benefits" in 4 days. Killed for now; it is Moat v2's B2B feature in disguise.

**C7. Agent-to-agent streaming payments / metered billing on x402.** Real gap (x402 is per-call only) but Stripe MPP and Nevermined are actively contesting it — build-a-protocol, not build-a-product. Killed.

**C8. "Defender refugee toolkit"** (migration wizard: import Defender Autotasks → KeeperHub workflows). Perfect timing story, genuinely useful — but it's a dev-tool utility with no value movement of its own, and half the rubric (execution, usefulness to integrated-project users) goes unsatisfied. Killed as main track; **the migration angle lives inside Moat's GTM messaging instead.**

---

## 5. Stress-Test Log — attacks on Moat, and answers

Each attack run multiple times. Remaining honest weaknesses listed in §7.

**A1. "Liquidation tooling is crowded."** Bots *liquidate*; DeFi Saver *protects* but only on Ethereum-mainnet lending markets, with no Morpho, no Base depth, no API, no agents. Instadapp is tied to their account abstraction; karpatkey is a managed service. On Morpho at $10B TVL: no at-scale protector exists. The gap is documented by third parties (Steakhouse), not by us.

**A2. "Why does this need an LLM? A cron + threshold rule suffices."** The strongest attack. Three answers. (1) *Composition is genuinely open-ended:* the optimal save depends on per-market LLTV, oracle source/freshness, swap routes and gas at decision time, which assets the user holds, yield being earned on collateral, and policy constraints — DeFi Saver hardcodes recipes for a handful of mainnet markets; Morpho's long tail of markets (hundreds, with new ones deployable permissionlessly) cannot be hardcoded. The composer reads live KeeperHub action schemas and composes a correct DAG per market. (2) *Determinism is preserved:* inference only at policy time, behind human approval — the hot path is a pure workflow. This is precisely KeeperHub's thesis, demonstrated rather than claimed. (3) *The critic agent* (a separately-prompted model red-teaming the plan) matches the multi-agent pattern the judges rewarded in ZW.ARM. If the LLM contributes nothing, judges will ask exactly A2 — and our architecture is the answer.

**A3. "Morpho has no global health factor like Aave."** Correct — risk is per-market borrow/collateral vs. LLTV, plus idiosyncratic oracles (Chainlink, Chronicle, Pyth, PT-oracles with different decay models). This is a *feature* for us: handling Morpho's actual risk model correctly (per-market ratios, oracle staleness guards, PT-oracle quirks) is the proof of integration specificity the top rubric line demands. It's also exactly why DeFi Saver-style hardcoded recipes don't transfer.

**A4. "An agent bug loses user money."** Mitigations, in depth: every plan is simulated before user approval and every armed workflow simulates its action step before broadcast; per-action spend caps enforced by agentic-wallet spending limits; action classes allowlisted by policy; idempotency keys prevent double-execution; protection actions are risk-*reducing* (top-up, repay) — the failure mode of a *bad* save is cost, not position loss, and the failure mode of *no* save is the liquidation we exist to prevent. Honest residual risk in §7.

**A5. "Only a demo position exists — no real users in 4 days."** Real funded positions on Base mainnet (gas is cents; $200–500 total capital at risk) provide the required tx-hash evidence. For "users of the integrated project benefit": every at-risk Morpho wallet is publicly identifiable — we run the scanner, protect our own positions live, and can show the invite pipeline end-to-end even if signups are early. Judges reward candor here; we will state exactly where the user count stands.

**A6. "Is a protocol a 'live project'?"** The brief's own words: "a project that exists and is running, with users, a deployed product or an active protocol behind it." Morpho is an active protocol with $10B TVL and Coinbase building on it. Additionally Moat integrates Chainlink/Chronicle (oracles), CoW/Aerodrome (execution venues), and Base (network) — multiple named live counterparties, with Morpho events *triggering* KeeperHub workflows, satisfying "triggers, consumes or benefits from."

**A7. "Too similar to ZW.ARM?"** Opposite job: ZW.ARM *earned yield*; Moat *prevents losses*. We deliberately replicate their winning *form* (mainnet, real txs, critic agent, tests) with a different product category.

**A8. "Why won't Morpho or DeFi Saver copy this?"** They might eventually — but DeFi Saver extending to Morpho/Base/agents is a multi-quarter pivot, Morpho Association building consumer protection conflicts with their infra focus (their pre-liquidations serve liquidators), and Moat's defensibility in-window is being the only agent-native, KeeperHub-executed, Base-first protector with a marketplace listing. First-mover in a vacuum beats feature-ticket in a roadmap.

**A9. "4 days is not enough."** The full vision isn't 4-day scope; §9 phases it. The 4-day core (single network, single protocol, dashboard + composer + critic + armed guard + audit trail + funded positions + tests + video) is aggressive but achievable with MCP-first integration and no custom smart contracts. **Zero contracts to deploy** is Moat's secret scope weapon — everything onchain is composed KeeperHub actions.

---

## 6. Rubric Win Table

| Criterion (verbatim) | Moat's answer | Evidence shown to judges |
|---|---|---|
| **Integration depth** — real, named project; integration specific to it | Morpho Blue ($10B TVL): per-market LLTV math, multiple oracle models incl. PT-oracles, Blue SDK reads, cbBTC-loop flagship case; plus Chainlink/Chronicle, CoW/Aerodrome, Base | Position dashboard reading live Morpho markets; Morpho-specific plan explanations |
| **Execution through KeeperHub** — did value move, can we see it | Every save is a KH workflow; mainnet (Base) tx hashes; `get_execution` output embedded in product UI | Live tx links + audit trail per run |
| **Reliability and observability** — survives non-happy path | KH nonce/gas/retry primitives; simulated-before-broadcast; failure branches in every workflow (insufficient balance → fallback action); oracle-staleness guard; alerting on failed runs | Demo of a failed-path run + recovery; logs surfaced |
| **Usefulness and originality** — solves something real for the integrated project's users | Borrowers lose 5–15% bonuses; $238M liquidated on Morpho in one week; only at-scale protector for Morpho, first agent-composed one anywhere | Per-user dollar math (50x framing); Steakhouse/Aave citations |
| **Developer experience and code quality** — another team could pick it up | Clean repo, README, architecture doc, 100+ tests (Tradewise lesson), `kh` CLI smoke scripts, candid "what breaks" | Test suite + CI + honest submission-form answers |

Bonus alignments: demonstrates KeeperHub's core determinism thesis better than any slide could (the sponsor's narrative in product form); uses optional surfaces (x402 marketplace listing, CLI, agentic-wallet limits) most teams skip.

---

## 7. Honest Risks — "what still breaks" (written now, reused in the submission form)

1. **Composer quality on exotic markets:** PT-oracle collateral and low-liquidity markets can produce plans that are correct-but-costly. Critic catches math/slip errors; edge cases remain. v1 launches with an allowlist of vetted high-liquidity Base markets.
2. **Flash-crash windows:** in a same-block cascade, workflow execution (even with private routing) may land after liquidation. Moat's triggers are deliberately early (act at 110% of LLTV, not 101%) — protection is probabilistic, not a guarantee. Say this out loud in the pitch.
3. **Gas spikes on Ethereum mainnet** (Base primary mitigates); Chainlink-style congestion skipping doesn't apply to KH's executor but gas costs still bound the "cheap save" claim in extremes.
4. **Cold-start users:** real funded positions are ours + any early invitees; the on-chain targeting pipeline exists but conversion takes weeks. Candid in form.
5. **Marketplace pricing of guards** is experimental; x402 per-execution payments are micro-volume ecosystem-wide (avg $0.21/tx) — we treat it as a distribution channel, not a revenue assumption.
6. **Regulatory surface:** non-custodial (user keys, Turnkey non-custodial infra via KH), no pooled funds, no yield promises — but consumer protection tooling in DeFI carries inherent optics risk; language must stay "automation," never "insurance."

---

## 8. Bounty Track Side-Play (separate BUIDL, stacks)

KeeperHub is open source; the $1,000 bounty ($500 × 2) rewards mergeable PRs: "a new chain integration, a new node, a new trigger or action, a connector, a developer experience improvement."

**Candidate PR: `morpho` position-read + protection actions** — contribute Morpho Blue market/position read actions (per-market ratio vs LLTV, oracle info) and/or a `morpho/protect` composite action with tests to `keeperhub/keeperhub`. It is directly extracted from Moat's build (not extra work), it's a "new action + connector" (two named bounty categories), and it deepens main-track integration-depth optics. Judge mergeability strictly: if KeeperHub's plugin surface resists a clean 4-day PR, drop it without regret — main track is the prize that matters. Decide by Day 3 (§9).

Note: requires a **separate BUIDL** from the main track per the rules.

---

## 9. Four-Day Build Plan (Sep 14 → Sep 17, buffer Sep 18 morning)

**Day 1 (Sep 14, today): infra + reads**
- KeeperHub MCP connection, `tools_documentation`, `list_action_schemas`; org + wallet setup; Base mainnet funding.
- Morpho Blue SDK position reads; risk engine (per-market ratio vs LLTV, oracle metadata). No LLM yet — pure math.
- Demo positions opened (small cbBTC/USDC borrow on Base).

**Day 2 (Sep 15): the agent loop**
- Composer agent: position + policy → KH workflow JSON (validate → simulate → create with idempotency key).
- Critic agent: red-team gate. Both behind the review UI.
- Manual breach test: push our demo position toward threshold, fire workflow, capture tx hash + logs.

**Day 3 (Sep 16): product shell + reliability**
- Dashboard (positions, policies, dry-run diff, runs + audit trail), alerts (Telegram), failure-branch workflows, spend caps.
- Marketplace listing + x402 pricing (attempt; timebox 2h).
- Bounty PR feasibility decision (§8).
- Test suite to 100+ (policy engine, risk math, workflow-graph validation).

**Day 4 (Sep 17): proof + pitch**
- Full mainnet run on real position; collect tx hashes, audit exports.
- Demo video: connect → policy → agent plan → dry-run diff → arm → forced breach → save → tx hash → audit trail.
- README, architecture doc, candid what-breaks, submission form. Submit Day 4 night / Sep 18 morning buffer.

De-scope order if time breaks: marketplace listing → Telegram alerts → Ethereum mainnet reads → critic agent (last resort only — it's a winning pattern, keep it).

---

## 10. Open Decisions (need your call before PRD)

1. **Name.** "Moat" — short, Morpho-adjacent, protection metaphor. Needs a 10-min conflict scan before it sticks.
2. **Bounty PR:** pursue (separate BUIDL) or skip? Recommendation: decide Day 3 by mergeability smell.
3. **Capital at risk:** $200–500 real funds on Base mainnet for demo positions. Approve budget.
4. **Network priority:** Base-first (recommend: cheap gas, Coinbase/Morpho flagship) with Ethereum mainnet as stretch — or mainnet-first for maximum judge optics at higher gas/complexity?
5. **Composer/critic models:** which LLM(s) run the two agents (budget + quality tradeoff).

---

## 11. Sources

- [DoraHacks newsletter — hackathon dates](https://dorahacks.io/blog/news/dora-hackathons) · [DevConnect hub](https://devconnectplatform.com/c/web3-hackathon-hub)
- [KeeperHub ETHGlobal OpenAgents wrap (winning patterns)](https://www.keeperhub.com/blog/010-openagents-hackathon-wrap)
- [OpenZeppelin Defender sunset FAQ](https://www.openzeppelin.com/news/defender-sunset-faq) · [Gelato W3F discontinuation / Mimic](https://mimic.fi/blog/gelato-web3-automation-is-ending-use-mimic) · [Chainlink Automation economics](https://docs.chain.link/chainlink-automation/overview/automation-economics)
- [Steakhouse — $238M Morpho liquidations](https://kitchen.steakhouse.financial/p/238m-liquidations-of-onchain-lending) · [Aave historical liquidations](https://aave.com/blog/historical-liquidations) · [Pangea — liquidator bonuses](https://blog.pangea.foundation/aaves-liquidators/) · [Amberdata — Aave liquidator profits](https://blog.amberdata.io/liquidator-profits-on-aavev2)
- [Morpho $10B TVL](https://eco.com/support/en/articles/13064566-morpho-protocol-explained-2026) · [DeFi Saver automation fees](https://defisaver.com/features/automation)
- [Chainalysis — x402 adoption](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/) · [WorkOS — x402 vs MPP](https://workos.com/blog/x402-vs-stripe-mpp-how-to-choose-payment-infrastructure-for-ai-agents-and-mcp-tools-in-2026)
- Wayfinder/Daydreams/Almanak dossiers: internal research Sep 14, 2026 (repos verified via GitHub API: [wayfinder-paths-sdk](https://github.com/WayfinderFoundation/wayfinder-paths-sdk), [lucid-agents](https://github.com/daydreamsai/lucid-agents), [almanak-co/sdk](https://github.com/almanak-co/sdk))
