---
name: keeperhub-integration
description: >
  Build integrations with KeeperHub — the deterministic onchain execution and reliability
  layer for AI agents. Use this skill when writing any code that creates workflows,
  executes onchain transactions, integrates with DeFi protocols, uses the KeeperHub
  MCP server, CLI, REST API, or x402/MPP agentic payment flows.
---

# KeeperHub Integration Skill

## What KeeperHub Is

KeeperHub is the **execution and reliability layer for AI agents operating onchain**. It provides:
- Deterministic, auditable workflow execution (nothing is inferred at execution time)
- 7 years of production infrastructure: nonce management, smart gas estimation, MEV protection, exponential backoff retries
- Non-custodial wallets via Turnkey; Safe smart account support
- MCP server with 30+ tools for AI agents
- REST API, CLI (`kh`), browser UI
- x402/MPP micropayment protocol for paid marketplace workflows
- 20+ DeFi protocol plugins, 20+ networks

## Core Access Surfaces

| Surface | Connection / Base URL |
|---|---|
| MCP Server | `https://app.keeperhub.com/mcp` |
| Per-workflow MCP | `https://app.keeperhub.com/mcp/w/<slug>` |
| REST API | `https://app.keeperhub.com/api` |
| CLI | `kh` (github.com/KeeperHub/cli) |

## MCP Server Setup

```bash
# Standard connection (OAuth via browser)
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp

# With API key (headless/CI)
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp \
  --header "Authorization: Bearer kh_your_key_here"

# Per-workflow (single typed tool — better LLM selection accuracy)
claude mcp add --transport http --scope user my-workflow \
  https://app.keeperhub.com/mcp/w/<slug> \
  --header "Authorization: Bearer kh_your_key_here"
```

**Multiple orgs** — add separate MCP server entries per org, each with its own API key.

## MCP Tool Reference (30+ tools)

### ALWAYS CALL FIRST
```
tools_documentation   — get authoritative, runtime tool docs
list_action_schemas   — get all available action types with schemas
```

### Workflow Lifecycle
```
list_workflows(projectId?, tagId?)
get_workflow(id)
create_workflow(name, nodes, edges, enabled=true, idempotency_key)
update_workflow(id, ...)
delete_workflow(id)
validate_workflow(nodes, edges)   ← call before create_workflow
prepare_test_pin_data(workflowId, nodeId, data)
validate_cron(expression)
ai_generate_workflow(description)
```

**Cold-start:** `create_workflow` / `ai_generate_workflow` may return `code: upstream_cold_start` with `retryAfterSeconds`. Retry with same `idempotency_key`.

### Execution
```
execute_workflow(id, inputs?)
get_execution(executionId)           ← contains transactionHashes
get_execution_status(executionId)    ← poll this
get_execution_logs(executionId)
list_executions(workflowId?)
call_workflow(slug, inputs)          ← marketplace workflows
```

**No 55-second timeout** on: `execute_workflow`, `execute_transfer`, `execute_contract_call`, `execute_check_and_execute`, `execute_protocol_action`, `call_workflow`, `get_direct_execution_status`.

### Direct On-Chain Execution
```
execute_transfer(chain_id, to_address, amount, simulate?, idempotency_key?)
execute_contract_call(chain_id, contractAddress, abi, abiFunction, params, simulate?, idempotency_key?)
execute_check_and_execute(...)
get_direct_execution_status(executionId)
```

### Protocol Actions (DeFi)
```
search_protocol_actions(protocol?, actionType?)  ← e.g. "aave-v3/supply"
execute_protocol_action(actionType, params, chain_id, simulate?, idempotency_key?)
```

### Discovery
```
list_action_schemas(category?)
get_plugin(id)
search_plugins(query)
search_templates(query)
deploy_template(templateId)
get_template(id)
```

### Marketplace
```
search_workflows(query)
list_workflow(workflowId, slug, description, inputSchema)
unlist_workflow(workflowId)
update_workflow_listing(...)
get_workflow_listing(workflowId)
```

### Agent Utilities
```
get_spending_limits()
test_notification(connectionId)
tempo_sign_and_hold(...)          ← requires mcp:write scope
tempo_cancel_hold(holdId)
tempo_release_hold(holdId)
get_wallet_integration()          ← confirm wallet is set up before write actions
list_integrations()
```

### Integrations & Docs
```
list_integrations()
get_wallet_integration()
tools_documentation()
```

### MCP Resources
```
keeperhub://workflows
keeperhub://workflows/{id}
```

## Workflow Construction

### Node Schema
```json
{
  "id": "unique-node-id",
  "type": "action",
  "data": {
    "label": "Human label",
    "description": "What this does",
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

**Trigger node:** `"type": "trigger"` with `triggerType` in config: `Manual`, `Schedule`, `Webhook`, `Event`, `Block`

### Edge Schema
```json
{ "id": "edge-1", "source": "trigger-1", "target": "action-1" }

// Condition node — requires sourceHandle:
{ "id": "edge-2", "source": "cond-1", "target": "node-a", "sourceHandle": "true" }
{ "id": "edge-3", "source": "cond-1", "target": "node-b", "sourceHandle": "false" }

// ForEach node uses "loop" and "done" sourceHandles
```

### Template Syntax (node output references)
```
{{@nodeId:Label.field}}
```

### Condition Operators
`==` `===` `!=` `!==` `>` `>=` `<` `<=` `contains` `startsWith` `endsWith` `matchesRegex` `isEmpty` `isNotEmpty` `exists` `doesNotExist` `isNull` `isNotNull` `isUndefined` `isNotUndefined`

## Chain IDs (always pass as strings)

| Network | ID |
|---|---|
| Ethereum Mainnet | `"1"` |
| Sepolia | `"11155111"` |
| Base | `"8453"` |
| Base Sepolia | `"84532"` |
| Arbitrum | `"42161"` |
| Polygon | `"137"` |
| Solana Mainnet | `"101"` |
| Solana Devnet | `"103"` |

> `simulate: true` is EVM-only. Solana IDs `101`/`103` reject simulation.

## Safe Preflight Pattern (ALWAYS do this for direct writes)

```typescript
// Step 1: Simulate — never broadcasts, no tx hash
const sim = await execute_transfer({
  chain_id: "84532",
  to_address: "0xRecipient",
  amount: "0.01",
  simulate: true   // MUST be boolean, not string "true"
});

// Step 2: Check result
if (sim.success === true && sim.wouldRevert === false) {
  // Step 3: Broadcast with unique idempotency_key
  const exec = await execute_transfer({
    chain_id: "84532",
    to_address: "0xRecipient",
    amount: "0.01",
    idempotency_key: crypto.randomUUID()
  });

  // Step 4: Poll with bounded backoff
  let status;
  let attempts = 0;
  do {
    await sleep(2000 * Math.pow(1.5, attempts));
    status = await get_direct_execution_status(exec.executionId);
    attempts++;
  } while (status.status !== "completed" && status.status !== "failed" && attempts < 10);
}
```

## Error Handling

### Error Format
```json
{ "content": [{ "type": "text", "text": "Error: <message>" }], "isError": true }
```

### Cold-Start Pattern
```typescript
const MAX_RETRIES = 3;
let result;
for (let i = 0; i < MAX_RETRIES; i++) {
  result = await create_workflow({ ..., idempotency_key: myKey });
  if (result.code !== "upstream_cold_start") break;
  await sleep((result.retryAfterSeconds ?? 5) * 1000);
}
```

### Simulate Error Classification
| Signal | Meaning | Action |
|---|---|---|
| `code` + `wouldRevert: true` | Attributed preflight failure (e.g., `insufficient_balance`) | Fix before broadcast |
| `failureKind: "revert"` + `wouldRevert: true` | EVM revert | Inspect calldata |
| `failureKind: "validation"` | Call construction / chain state | Validate inputs |

## Web3 Action Reference

### Read Actions (no wallet required)
```
web3/check-balance         → network, address
web3/check-token-balance   → network, address, tokenConfig
web3/get-spl-token-balance → network, address, tokenConfig  (Solana)
web3/read-contract         → network, contractAddress, abi, abiFunction
```

### Write Actions (wallet integration required)
```
web3/transfer-funds        → network, recipientAddress, amount
web3/transfer-token        → network, recipientAddress, tokenConfig, amount
web3/write-contract        → network, contractAddress, abi, abiFunction, [params]
```

**`abiFunction`:** Plain name for unique functions (`"balanceOf"`) or full signature for overloads (`"transfer(address,uint256)"`).

**`tokenConfig`:** Token-select object (token + network combined), NOT a bare address.

**Before any write:** Call `get_wallet_integration()` to confirm wallet is configured. If not configured, writes will fail.

## Available DeFi Plugins

### Lending / Borrowing
`aave-v3` `aave-v4` `morpho` `compound` `spark` `ajna`

### DEXes
`uniswap` `aerodrome` `curve` `cowswap`

### Staking / Liquid Staking
`lido` `rocket-pool` `ethena` `frax-ether-v2`

### Yield
`yearn-v3` `pendle`

### Streaming
`superfluid`

### Cross-chain
`layerzero`

### Multisig
`safe`

### Oracles / Data
`chainlink` `chronicle` `blockscout`

### Notifications
`telegram` `discord` `slack` `sendgrid` `webhook`

### TradFi
`hyperliquid` `robinhood`

## REST API (Headless)

Base: `https://app.keeperhub.com/api`  
Auth: `Authorization: Bearer kh_<org_api_key>`

```
GET  /workflows               — list
POST /workflows               — create
GET  /workflows/{id}          — get
PATCH /workflows/{id}         — update
DELETE /workflows/{id}        — delete
POST /workflows/{id}/execute  — execute
GET  /executions/{id}         — get execution
POST /execute/transfer        — direct transfer
POST /execute/contract-call   — direct contract call
GET  /execute/{id}/status     — poll
GET  /chains                  — supported chains
GET  /plugins                 — available plugins
GET  /analytics               — usage
```

## CLI Reference

```bash
kh auth login / logout / status
kh workflow create / list / get / update / delete / run / enable / disable / go-live
kh execute transfer --to 0x... --amount 0.01 --chain 8453
kh execute contract-call --contract 0x... --abi ./abi.json --fn transfer
kh execute status <executionId>
kh run logs / status / cancel
kh wallet info / balance / fund / add / link / tokens
kh plugin list / get
kh template list / deploy
kh chain list
kh org list / switch / members
kh project create / list / get / delete
kh read  # read contract
kh doctor  # env check
```

## Authentication

| Method | How |
|---|---|
| OAuth 2.1 | Browser flow; 1-hr access + 30-day refresh tokens |
| API key | `Authorization: Bearer kh_<key>` — org key from Settings > Developer > API keys |

Scope: Each MCP connection is scoped to **one organization**. To switch orgs, remove and re-add the MCP server.

## Agentic Wallet (x402/MPP)

The agentic wallet intercepts HTTP 402 responses from paid marketplace workflow calls:
- Evaluates price against configurable thresholds
- Autopays below threshold; prompts above
- Works with `tempo_sign_and_hold` + `tempo_release_hold` for time-locked execution

Install: https://docs.keeperhub.com/agent/agentic-wallet

## Common Mistakes to Avoid

1. **Using `simulate: "true"` (string)** — must be boolean `true`
2. **Not calling `validate_workflow` before `create_workflow`** — always validate first
3. **Not calling `get_wallet_integration` before write actions** — wallet must be configured
4. **Using bare token address in `tokenConfig`** — use the token-select object format
5. **Passing chain IDs as numbers** — always pass as strings (`"8453"`, not `8453`)
6. **Ignoring cold-start errors** — must retry with same `idempotency_key`
7. **Calling ethers.js directly for onchain writes** — all writes must go through KeeperHub
8. **Not using `sourceHandle` for condition nodes** — edges from Condition nodes REQUIRE `sourceHandle: "true"` or `"false"`
9. **Forgetting `idempotency_key` for retries** — must be same key on retry
10. **Treating KeeperHub as a notification sidecar** — it must be the execution layer

## Key Documentation Links

- Docs: https://docs.keeperhub.com/
- MCP Server Guide: https://docs.keeperhub.com/ai-tools/mcp-server
- Agent Tools: https://docs.keeperhub.com/agent
- Agentic Wallet: https://docs.keeperhub.com/agent/agentic-wallet
- Workflow Schema: https://docs.keeperhub.com/workflows/schema-reference
- Templating: https://docs.keeperhub.com/workflows/templating
- Plugins: https://docs.keeperhub.com/plugins/overview
- API Ref: https://docs.keeperhub.com/api
- CLI Ref: https://docs.keeperhub.com/cli
- Direct Execution: https://docs.keeperhub.com/api/direct-execution
- First Tx Guide: https://docs.keeperhub.com/guides/first-verified-transaction
- GitHub: https://github.com/keeperhub/keeperhub
