# KeeperHub Hackathon — Deep Analysis

> **Purpose:** Full research dump for builders and coding agents. Everything sourced directly from docs, the info brief, and ecosystem study. Zero hallucination policy — where data is confirmed, it is stated; where it is inferred, it is marked as such.

---

## 1. What KeeperHub Actually Is

KeeperHub is a **7-year-old production automation infrastructure layer** that was purpose-built around deterministic, auditable onchain execution. It is not an AI product bolted onto Web3 — it is Web3 plumbing that agents can now speak to via MCP.

### Core Guarantee
> *"Nothing is inferred at execution time."*

An agent composes a workflow, the user reviews it, dry-runs it without touching the chain, and then **that exact workflow executes** — same bytes, same nonce sequence, same gas parameters. No reinterpretation mid-flight.

### Production Infrastructure It Wraps
| Layer | What It Handles |
|---|---|
| Nonce management | Stuck transactions, race conditions |
| Smart Gas Estimation | No manual `gasPrice` tuning |
| Private routing | MEV protection |
| Retries | Exponential backoff, idempotency keys |
| Wallets | Non-custodial via Turnkey; Safe smart accounts |
| Audit trail | Every workflow run, every tx hash, every log line |
| Scale | 20+ protocols, 20+ networks |

### Access Surfaces
| Surface | What It Does |
|---|---|
| **MCP Server** | Exposes 30+ tools to any AI agent (Claude Code, Cursor, custom) |
| **CLI (`kh`)** | Full workflow lifecycle; CI/CD integration |
| **REST API** | Headless onboarding, direct execution, analytics |
| **Browser UI** | Visual workflow builder |
| **x402 / MPP** | HTTP 402 micropayment protocol — agents pay for listed workflows |
| **Agentic Wallet** | PreToolUse safety hook; intercepts 402s, evaluates price threshold, autopays |
| **Workflow Marketplace** | Published workflows callable as MCP tools via per-workflow slug endpoints |

---

## 2. Previous Hackathon — "Agents Onchain" (July–August 2025)

### What We Know (from the brief)
- **471 builders** registered
- **190 projects** submitted
- Every submission was reviewed **at repository level** (not form answers)
- KeeperHub is running this as their **second** DoraHacks hackathon — the first was "Agents Onchain"

### Patterns in What Won (Inferred from Judging Language + New Brief Constraints)
KeeperHub explicitly said this second hackathon brief is **"tighter"**. That means the first round had too many:
- Standalone demos with no live project on the other side
- Generic wrappers that called KeeperHub as an afterthought
- Integrations that used a single KeeperHub surface (e.g., just a CLI call)

**What separated winners (inferred from the tighter second-round constraints):**
1. Integrated into a **named, live, deployed protocol or project**
2. Showed **actual value movement** — a transaction hash was required
3. Used KeeperHub as the **execution layer**, not a notification sidecar
4. Could be run live in a **demo call** without slides
5. Code was clean enough that **another team could pick it up**

### Example Projects Named in Brief (not a shortlist — just examples)
- **Wayfinder** — AI navigation layer for onchain actions
- **Daydreams** — AI agent framework for autonomous onchain agents
- **Almanak** — AI-powered portfolio/simulation layer

---

## 3. What the Ecosystem Needs (Real Gaps)

### 3a. The Agent-to-Chain Execution Gap
Every AI agent framework (Daydreams, Wayfinder, ElizaOS, Almanak, etc.) can **plan** onchain actions but has no reliable way to **execute** them without:
- Writing their own nonce management
- Handling gas spikes manually
- Dealing with stuck transactions
- Building audit trails from scratch

KeeperHub closes every one of those gaps.

### 3b. The "Human in the Loop" Problem for High-Stakes Tx
AI agents are probabilistic. When a user says "rebalance my DeFi positions," the agent's interpretation at execution time may differ from what the user meant when they approved. KeeperHub's **dry-run/review model** solves this:
1. Agent composes workflow via MCP
2. User reviews workflow in browser before any tx is signed
3. User approves → execution is deterministic

### 3c. Missing Protocol Automation
Protocols like Aave, Morpho, Pendle, Aerodrome, Superfluid exist in KeeperHub's plugin library. The missing thing is **agent-triggered automation** — e.g.:
- Health factor monitoring → auto top-up collateral
- Yield optimization → rebalance between Morpho markets
- Streaming payments (Superfluid) → start/stop based on conditions
- Cross-chain bridging (LayerZero) → triggered by portfolio events

### 3d. x402 Monetization Layer
KeeperHub is one of the only platforms that natively implements the **HTTP 402 payment protocol** for agent-to-agent payments. Workflows can be **listed and sold** on the marketplace. Agents with an agentic wallet can autopay. This is a completely unexplored primitive for most builders.

---

## 4. What Judges Actually Score

### Main Track Rubric (exact from brief)

| Criterion | What It Really Means |
|---|---|
| **Integration depth** | Named project on the other side. Specific, not generic. Judges verify the integration against the other project's actual GitHub/docs. |
| **Execution through KeeperHub** | Transaction hash required. Testnet accepted but mainnet is stronger. |
| **Reliability and observability** | Does it handle failure? Error paths, retry logic, the non-happy path. |
| **Usefulness and originality** | Real problem for users of the *integrated* project, not a proof of concept. |
| **Developer experience and code quality** | Could another team fork and deploy this? README, setup instructions, clean API surface. |

### Bounty Track Rubric

| Criterion | What It Really Means |
|---|---|
| **Mergeability** | Pull request must be ready to merge. Tests passing, no conflicts, follows existing code style. |
| **Value to the platform** | Does it add a new chain, trigger type, action node, or DX improvement? |
| **Code quality and tests** | Tests are explicitly required — not optional. |
| **Scope and completeness** | Partial implementations won't win. End-to-end only. |

### What Kills Submissions
- No transaction hash (eliminates from main track)
- Demo video showing a UI but no actual onchain execution
- Integration that doesn't name the specific project
- Bad code — judges review the repository directly
- "KeeperHub as a notification service" pattern

### What Wins
- Live pitch: run the actual integration, not slides
- A real project with real users that now executes value through KeeperHub
- Using: MCP + audit trail + dry-run (minimum), ideally more surfaces
- Candid answer about what's broken (judges reward honesty)

---

## 5. KeeperHub as a Pillar, Not a Sidekick

### The Anti-Pattern (Sidekick)
> Agent decides to do X → calls KeeperHub to send a notification → sends tx directly via ethers.js

KeeperHub is irrelevant in this pattern.

### The Correct Pattern (Pillar)
> Agent decides to do X → composes KeeperHub workflow via MCP → workflow handles: gas, nonce, MEV, retries, audit → tx executes deterministically

Remove KeeperHub and the system breaks.

### Design Checklist for "Pillar" Status
- [ ] All onchain writes go through KeeperHub — no direct `eth_sendTransaction` calls
- [ ] Workflow review step exists before execution (even if via agent wallet autopay)
- [ ] Audit trail is surfaced — show the run logs or tx hash in your UI
- [ ] Error handling uses KeeperHub signals (retry with `retryAfterSeconds`, handle `upstream_cold_start`)
- [ ] Dry-run before live — use `simulate: true` before broadcast

---

## 6. KeeperHub Plugin Ecosystem (Available DeFi Actions)

Discoverable via MCP tool `list_action_schemas` or `search_protocol_actions`.

### DeFi Protocols
| Protocol | Available Actions |
|---|---|
| **Aave V3 / V4** | Supply, borrow, repay, withdraw, health factor reads |
| **Morpho** | Supply, withdraw, market reads |
| **Compound V3** | Supply, withdraw, borrow |
| **Uniswap** | Swaps |
| **Aerodrome** | Swap, liquidity |
| **Curve** | Swap, liquidity |
| **CoW Swap** | MEV-protected swaps |
| **Lido** | ETH staking / unstaking |
| **Rocket Pool** | rETH interactions |
| **Pendle** | Yield tokenization |
| **Ethena** | sUSDe interactions |
| **Frax Ether V2** | frxETH |
| **Yearn V3** | Vault deposits/withdrawals |
| **Sky** | MakerDAO/Sky protocol |
| **Spark** | SparkLend (DAI-based lending) |
| **Ajna** | Permissionless lending |
| **Superfluid** | Token streaming |
| **LayerZero** | Cross-chain messaging |
| **Safe** | Multi-sig wallet operations |

### Infrastructure / Oracle
| Plugin | What It Does |
|---|---|
| **Web3** | Read/write any contract, check balances, token transfers |
| **Chainlink** | Price feed reads |
| **Chronicle** | Oracle reads |
| **Blockscout** | On-chain data queries |
| **Tempo** | Time-based triggers, sign-and-hold |
| **Math** | Arithmetic in workflows |
| **Data** | Data transformation |
| **Code** | Custom code execution |

### Notifications / Comms
| Plugin | What It Does |
|---|---|
| **Telegram** | Send messages |
| **Discord** | Send messages |
| **Slack** | Send messages |
| **SendGrid** | Email |
| **Webhook** | Generic HTTP out |

### TradFi Crossover
| Plugin | What It Does |
|---|---|
| **Hyperliquid** | Perp DEX automation |
| **Robinhood** | Traditional brokerage (beta) |

---

## 7. MCP Server — Complete Technical Reference for Coding Agents

### Connection
```bash
# Remote (recommended) — no local process needed
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp

# With API key (headless/CI)
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp \
  --header "Authorization: Bearer kh_your_key_here"

# Per-workflow narrow endpoint (better LLM tool selection — one tool instead of a dispatcher)
claude mcp add --transport http --scope user my-workflow \
  https://app.keeperhub.com/mcp/w/<slug> \
  --header "Authorization: Bearer kh_your_key_here"
```

### Multiple Organizations
```json
{
  "mcpServers": {
    "keeperhub-org1": {
      "type": "http",
      "url": "https://app.keeperhub.com/mcp",
      "headers": { "Authorization": "Bearer kh_key1" }
    },
    "keeperhub-org2": {
      "type": "http",
      "url": "https://app.keeperhub.com/mcp",
      "headers": { "Authorization": "Bearer kh_key2" }
    }
  }
}
```

### Full Tool List (30+ tools)

#### Workflow Management
| Tool | Notes |
|---|---|
| `list_workflows` | Filter by `projectId`, `tagId` |
| `get_workflow` | Get by ID |
| `create_workflow` | nodes + edges; set `enabled=true`; use `idempotency_key` |
| `update_workflow` | Patch; disable with `enabled=false` |
| `delete_workflow` | Permanent |
| `validate_workflow` | Schema check before creation |
| `prepare_test_pin_data` | Pin test trigger data |
| `validate_cron` | Validate cron expression |
| `ai_generate_workflow` | Natural language → workflow |

**Cold-start note:** `create_workflow` and `ai_generate_workflow` may return `code: upstream_cold_start` (HTTP 502/503/504). Includes `retryAfterSeconds`. Retry once or twice with bounded backoff using the same `idempotency_key`.

#### Execution
| Tool | Notes |
|---|---|
| `execute_workflow` | Run a workflow by ID |
| `get_execution` | Full details including `transactionHashes` |
| `get_execution_status` | Poll status |
| `get_execution_logs` | Log lines |
| `list_executions` | History |
| `call_workflow` | Call marketplace workflow by slug with inputs |

**Timeout note:** `execute_workflow`, `execute_transfer`, `execute_contract_call`, `execute_check_and_execute`, `execute_protocol_action`, `call_workflow`, `get_direct_execution_status` — all disable the 55-second timeout so on-chain work completes.

#### Direct On-Chain Execution (no workflow needed)
| Tool | Notes |
|---|---|
| `execute_transfer` | Direct ETH/token transfer |
| `execute_contract_call` | Direct contract write |
| `execute_check_and_execute` | Conditional: check state, then execute |
| `get_direct_execution_status` | Poll until `completed` or `failed` |

#### Protocol Actions (DeFi)
| Tool | Notes |
|---|---|
| `search_protocol_actions` | Find by `actionType` e.g. `aave-v3/supply` |
| `execute_protocol_action` | Execute the found action |

#### AI Generation & Discovery
| Tool | Notes |
|---|---|
| `ai_generate_workflow` | Natural language → workflow |
| `list_action_schemas` | All action types with schemas (always authoritative) |
| `get_plugin` | Plugin details |
| `search_plugins` | Search plugins |
| `search_templates` | Search templates |
| `deploy_template` | Deploy template to your org |
| `get_template` | Get template |

#### Marketplace
| Tool | Notes |
|---|---|
| `search_workflows` | Find listed workflows |
| `call_workflow` | Call listed workflow by slug |
| `list_workflow` | Publish to marketplace |
| `unlist_workflow` | Remove from marketplace |
| `update_workflow_listing` | Update listing metadata |
| `get_workflow_listing` | Get listing |

#### Agent Utilities
| Tool | Notes |
|---|---|
| `get_spending_limits` | Agent spending thresholds |
| `test_notification` | Test notification connection |
| `tempo_sign_and_hold` | Sign tx, hold broadcast (requires `mcp:write` scope) |
| `tempo_cancel_hold` | Cancel held tx |
| `tempo_release_hold` | Broadcast held tx |
| `get_wallet_integration` | Confirm wallet is configured |
| `list_integrations` | All org integrations |
| `tools_documentation` | Get authoritative tool docs at runtime (always call this first) |

### MCP Resources
```
keeperhub://workflows          # All workflows
keeperhub://workflows/{id}     # Single workflow
```

### Workflow Node Structure
```json
{
  "id": "node-id",
  "type": "action",
  "data": {
    "label": "Human readable label",
    "description": "What this node does",
    "type": "action",
    "config": {
      "actionType": "web3/check-balance",
      "network": "8453",
      "address": "0x..."
    },
    "status": "idle"
  }
}
```

**Trigger node:** `"type": "trigger"` with `triggerType` in config:
- `Manual` — on-demand
- `Schedule` — cron-based
- `Webhook` — HTTP trigger
- `Event` — onchain event listener
- `Block` — per-block

### Workflow Edge Structure
```json
// Basic edge
{ "id": "edge-1", "source": "trigger-1", "target": "node-1" }

// Condition node requires sourceHandle:
{ "id": "edge-2", "source": "cond-1", "target": "send-alert", "sourceHandle": "true" }
{ "id": "edge-3", "source": "cond-1", "target": "skip", "sourceHandle": "false" }

// ForEach node uses "loop" and "done" sourceHandles
```

### Template Syntax (referencing node outputs)
```
{{@nodeId:Label.field}}
```

### Condition Operators
`==` `===` `!=` `!==` `>` `>=` `<` `<=` `contains` `startsWith` `endsWith` `matchesRegex` `isEmpty` `isNotEmpty` `exists` `doesNotExist` `isNull` `isNotNull` `isUndefined` `isNotUndefined`

### Network Chain IDs (pass as strings)
| Network | Chain ID |
|---|---|
| Ethereum Mainnet | `"1"` |
| Sepolia | `"11155111"` |
| Base | `"8453"` |
| Base Sepolia | `"84532"` |
| Arbitrum | `"42161"` |
| Polygon | `"137"` |
| Solana Mainnet | `"101"` |
| Solana Devnet | `"103"` |

> ⚠️ `simulate: true` is EVM-only. Solana chain IDs `101`/`103` reject simulation.

### Safe Preflight Pattern (Direct Writes)
```json
// Step 1: Simulate — never broadcasts
{ "chain_id": "84532", "to_address": "0xRecipient", "amount": "0.01", "simulate": true }

// Step 2: If { success: true, wouldRevert: false } → broadcast with idempotency_key
{ "chain_id": "84532", "to_address": "0xRecipient", "amount": "0.01", "idempotency_key": "unique-uuid" }

// Step 3: Poll with bounded backoff
get_direct_execution_status(executionId) // → "completed" or "failed"
```

> `simulate` MUST be JSON boolean `true`, NOT string `"true"`.

### Error Classification (simulate=true responses)
| Signal | Meaning |
|---|---|
| `code` + `wouldRevert: true` | Attributed preflight failure (e.g., `insufficient_balance`) |
| `failureKind: "revert"` + `wouldRevert: true` | EVM revert |
| `failureKind: "validation"` | Deterministic failure, no attributed code |

Error format:
```json
{ "content": [{ "type": "text", "text": "Error: <message>" }], "isError": true }
```

### Web3 Action Reference

**Read Actions (no wallet required):**
- `web3/check-balance` — requires: `network`, `address`
- `web3/check-token-balance` — requires: `network`, `address`, `tokenConfig`
- `web3/get-spl-token-balance` — Solana; requires: `network`, `address`, `tokenConfig`
- `web3/read-contract` — requires: `network`, `contractAddress`, `abi`, `abiFunction`

**Write Actions (require wallet integration):**
- `web3/transfer-funds` — requires: `network`, `recipientAddress`, `amount`
- `web3/transfer-token` — requires: `network`, `recipientAddress`, `tokenConfig`, `amount`
- `web3/write-contract` — requires: `network`, `contractAddress`, `abi`, `abiFunction`

**`abiFunction` field:** Pass plain name for unique functions (`"balanceOf"`) or full signature for overloads (`"transfer(address,uint256)"`).

**`tokenConfig`:** Token-select value (token + network), not a bare address.

**Write actions:** Org's wallet integration must be configured. No per-action `walletId` field. Use `get_wallet_integration` to confirm.

### Authentication
| Method | How |
|---|---|
| OAuth 2.1 | Browser flow via `/mcp`; 1-hr access tokens, 30-day refresh |
| API key | `Authorization: Bearer kh_<key>` — org key from Settings > Developer > API keys |

Scope: Each MCP connection is scoped to a **single organization**.

---

## 8. CLI Reference (`kh`)

Source: https://github.com/KeeperHub/cli

```bash
# Auth
kh auth login / logout / status

# Workflows
kh workflow create / list / get / update / delete
kh workflow run / enable / disable / go-live

# Direct execution
kh execute transfer --to 0x... --amount 0.01 --chain 8453
kh execute contract-call --contract 0x... --abi ./abi.json --fn transfer
kh execute status <executionId>

# Run monitoring
kh run logs <runId>
kh run status / cancel

# Wallet
kh wallet info / balance / fund / add / link / tokens / feedback

# Templates & plugins
kh template list / deploy
kh plugin list / get

# Misc
kh chain list
kh org list / switch / members
kh project create / list / get / delete
kh tag create / list / get / delete
kh read (read contract)
kh doctor (env check)
kh update
kh version
kh config get / set / list
kh billing status / usage
kh completion
```

---

## 9. REST API Reference

Base URL: `https://app.keeperhub.com/api`  
Auth: `Authorization: Bearer kh_<org_api_key>`

Key endpoint groups:
- `GET/POST /workflows` — CRUD
- `POST /workflows/{id}/execute` — execute
- `GET /executions/{id}` — results + tx hashes
- `POST /execute/transfer` — direct transfer
- `POST /execute/contract-call` — direct contract call
- `GET /execute/{id}/status` — poll status
- `GET /chains` — supported chains
- `GET /plugins` — available plugins
- `GET /analytics` — usage data
- `POST /api-keys` — manage API keys
- `GET /organizations` — org management
- `POST /headless-onboarding` — programmatic onboarding

Full reference: https://docs.keeperhub.com/api

---

## 10. Agentic Wallet (x402/MPP)

- Intercepts HTTP 402 responses from paid marketplace workflow calls
- PreToolUse hook evaluates price against configurable safety thresholds
- Autopays below threshold; prompts above
- Works with `tempo_sign_and_hold` / `tempo_release_hold` for time-locked execution

Install docs: https://docs.keeperhub.com/agent/agentic-wallet  
Claude Code Plugin (adds x402 support + slash commands): https://docs.keeperhub.com/agent/claude-code-plugin

---

## 11. Workflow Schema Reference

Full schema: https://docs.keeperhub.com/workflows/schema-reference  
Templating: https://docs.keeperhub.com/workflows/templating  
Import/Export: https://docs.keeperhub.com/workflows/import-export  
Hub & Marketplace: https://docs.keeperhub.com/workflows/hub

```json
{
  "name": "My Workflow",
  "description": "What it does",
  "enabled": true,
  "nodes": [...],
  "edges": [...],
  "projectId": "optional",
  "tags": []
}
```

---

## 12. Wallet Management

- **Turnkey**: Non-custodial wallet creation — https://docs.keeperhub.com/wallet-management/turnkey
- **Safe**: Multi-sig via Safe smart accounts — https://docs.keeperhub.com/wallet-management/safe
- **Gas Management**: Auto-estimated, no manual config — https://docs.keeperhub.com/wallet-management/gas
- **Address Book**: Named addresses for reuse — https://docs.keeperhub.com/wallet-management/address-book

> ⚠️ If org routes writes through a Safe, the simulation sender is the Turnkey org wallet, NOT the Safe. The broadcast then goes through the Safe. See: https://docs.keeperhub.com/api/direct-execution#known-limitation

---

## 13. Integration Strategy — How to Win

### The Winning Formula
```
Live Project + KeeperHub as Execution Layer + Tx Hash + Live Demo = Win
```

### Recommended Architecture Pattern
```
[Live Project Event] 
    → [Agent reads intent] 
    → [Agent calls list_action_schemas / search_protocol_actions] 
    → [Agent calls create_workflow with nodes + edges]
    → [Agent calls validate_workflow]
    → [User review OR agentic wallet autopay]
    → [Agent calls execute_workflow]
    → [Agent polls get_execution until tx hash confirmed]
    → [Live project receives tx hash + audit trail]
```

### Surfaces to Use (judges will ask which ones)
- [x] MCP Server — workflow creation/execution
- [x] Audit trail — `get_execution_logs`, show tx hash
- [x] Dry-run / simulate — `simulate: true` before broadcast
- [x] At least one DeFi plugin — shows ecosystem depth
- [ ] x402 / MPP — marketplace + agentic wallet autopay
- [ ] CLI — shows developer tooling awareness
- [ ] Agent-authored workflows — AI generating the workflow schema

### Submission Form Required Answers
1. Which project did you integrate with? What does the integration do?
2. Which KeeperHub surfaces: `MCP`, `CLI`, `x402`, `MPP`, `agent-authored workflows`, `audit trail`
3. Testnet or mainnet?
4. What still breaks or is unfinished? (answer candidly)
5. Contact: email + X or Discord handle

### Three Required Deliverables
1. Source code link (public repo — judges review at code level)
2. Demo video showing the integration working
3. Link to a transaction executed through KeeperHub

---

## 14. All Resource Links

| Resource | URL |
|---|---|
| Docs home | https://docs.keeperhub.com/ |
| **MCP Server Guide** | https://docs.keeperhub.com/ai-tools/mcp-server |
| Agent Tools Overview | https://docs.keeperhub.com/agent |
| MCP Server (agent section) | https://docs.keeperhub.com/agent/mcp-server |
| **Agentic Wallet** | https://docs.keeperhub.com/agent/agentic-wallet |
| Claude Code Plugin | https://docs.keeperhub.com/agent/claude-code-plugin |
| MCP Trigger Inputs | https://docs.keeperhub.com/agent/mcp-trigger-inputs |
| Validate Workflow | https://docs.keeperhub.com/agent/mcp-validate-workflow |
| Test Workflow | https://docs.keeperhub.com/agent/mcp-test-workflow |
| Get Execution | https://docs.keeperhub.com/agent/mcp-get-execution |
| Getting Started | https://docs.keeperhub.com/getting-started |
| Getting Started (Agent/MCP) | https://docs.keeperhub.com/getting-started/agent |
| Getting Started (API) | https://docs.keeperhub.com/getting-started/api |
| Getting Started (CLI) | https://docs.keeperhub.com/getting-started/cli |
| Core Concepts | https://docs.keeperhub.com/concepts |
| Platform Reference | https://docs.keeperhub.com/platform-reference |
| Nodes Overview | https://docs.keeperhub.com/keepers |
| Node Types | https://docs.keeperhub.com/keepers/overview |
| Node Configuration | https://docs.keeperhub.com/keepers/configuration |
| **Workflows Overview** | https://docs.keeperhub.com/workflows |
| Creating Workflows | https://docs.keeperhub.com/workflows/creating |
| **Templating Reference** | https://docs.keeperhub.com/workflows/templating |
| **Schema Reference** | https://docs.keeperhub.com/workflows/schema-reference |
| Import/Export | https://docs.keeperhub.com/workflows/import-export |
| Workflow Hub | https://docs.keeperhub.com/workflows/hub |
| Marketplace | https://docs.keeperhub.com/workflows/marketplace |
| **Plugins Overview** | https://docs.keeperhub.com/plugins/overview |
| Keeper Runs | https://docs.keeperhub.com/keeper-runs |
| Status and Logs | https://docs.keeperhub.com/keeper-runs/status-logs |
| Error Codes | https://docs.keeperhub.com/keeper-runs/error-codes |
| Performance Monitoring | https://docs.keeperhub.com/keeper-runs/monitoring |
| Wallet Management | https://docs.keeperhub.com/wallet-management |
| Turnkey Integration | https://docs.keeperhub.com/wallet-management/turnkey |
| Safe Smart Accounts | https://docs.keeperhub.com/wallet-management/safe |
| Gas Management | https://docs.keeperhub.com/wallet-management/gas |
| **API Overview** | https://docs.keeperhub.com/api |
| API Authentication | https://docs.keeperhub.com/api/authentication |
| Direct Execution API | https://docs.keeperhub.com/api/direct-execution |
| Executions API | https://docs.keeperhub.com/api/executions |
| **CLI Overview** | https://docs.keeperhub.com/cli |
| CLI Quickstart | https://docs.keeperhub.com/cli/quickstart |
| CLI Concepts | https://docs.keeperhub.com/cli/concepts |
| Guides | https://docs.keeperhub.com/guides |
| First Verified Transaction | https://docs.keeperhub.com/guides/first-verified-transaction |
| Defender Migration | https://docs.keeperhub.com/guides/defender-migration |
| Gelato Migration | https://docs.keeperhub.com/guides/gelato-migration |
| FAQ | https://docs.keeperhub.com/FAQ |
| **GitHub (source)** | https://github.com/keeperhub/keeperhub |
| Discord | https://discord.gg/keeperhub |
| Link Tree | https://keeperhub.com/links |
| DoraHacks Hackathon | https://dorahacks.io/hackathon/keeperhub |
