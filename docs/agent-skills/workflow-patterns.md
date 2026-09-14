# KeeperHub Workflow Patterns — Hallucination-Free Reference

> **Moat:** copy-paste patterns below often use `"8453"` and `cron`. Use `"84532"` and `scheduleCron`. Full live overrides: `docs/CONTEXT.md`.

Concrete, copy-paste patterns sourced directly from KeeperHub docs.

---

## Pattern 1: Trigger → Read → Condition → Write

```json
{
  "name": "Auto-Rebalance on Condition",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "data": {
        "label": "Schedule Trigger",
        "type": "trigger",
        "config": { "triggerType": "Schedule", "cron": "0 */4 * * *" },
        "status": "idle"
      }
    },
    {
      "id": "read-balance",
      "type": "action",
      "data": {
        "label": "Check Balance",
        "type": "action",
        "config": {
          "actionType": "web3/check-balance",
          "network": "8453",
          "address": "0xYourWalletAddress"
        },
        "status": "idle"
      }
    },
    {
      "id": "condition-1",
      "type": "condition",
      "data": {
        "label": "Balance Low?",
        "type": "condition",
        "config": {
          "conditions": [
            {
              "leftValue": "{{@read-balance:Check Balance.balance}}",
              "operator": "<",
              "rightValue": "0.1"
            }
          ]
        },
        "status": "idle"
      }
    },
    {
      "id": "send-alert",
      "type": "action",
      "data": {
        "label": "Send Telegram Alert",
        "type": "action",
        "config": {
          "actionType": "telegram/send-message",
          "message": "Balance low: {{@read-balance:Check Balance.balance}} ETH"
        },
        "status": "idle"
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger-1", "target": "read-balance" },
    { "id": "e2", "source": "read-balance", "target": "condition-1" },
    { "id": "e3", "source": "condition-1", "target": "send-alert", "sourceHandle": "true" }
  ]
}
```

---

## Pattern 2: Webhook Trigger → DeFi Action

```json
{
  "name": "Agent-Triggered Aave Supply",
  "nodes": [
    {
      "id": "webhook-trigger",
      "type": "trigger",
      "data": {
        "label": "Webhook",
        "type": "trigger",
        "config": { "triggerType": "Webhook" },
        "status": "idle"
      }
    },
    {
      "id": "aave-supply",
      "type": "action",
      "data": {
        "label": "Supply to Aave",
        "type": "action",
        "config": {
          "actionType": "aave-v3/supply",
          "network": "8453",
          "asset": "0xUSDC_ADDRESS",
          "amount": "{{trigger.body.amount}}"
        },
        "status": "idle"
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "webhook-trigger", "target": "aave-supply" }
  ]
}
```

---

## Pattern 3: MCP Agent Workflow Creation (TypeScript pseudocode)

```typescript
// Step 1: Discover available actions
const schemas = await mcp.list_action_schemas({ category: "defi" });

// Step 2: Validate planned workflow
const validation = await mcp.validate_workflow({
  nodes: plannedNodes,
  edges: plannedEdges
});
if (!validation.valid) throw new Error(validation.errors.join(", "));

// Step 3: Create workflow
const workflow = await mcp.create_workflow({
  name: "My Integration Workflow",
  nodes: plannedNodes,
  edges: plannedEdges,
  enabled: true,
  idempotency_key: crypto.randomUUID()
});

// Step 4: Execute
const execution = await mcp.execute_workflow(workflow.id);

// Step 5: Poll for completion
let result;
do {
  await new Promise(r => setTimeout(r, 2000));
  result = await mcp.get_execution_status(execution.executionId);
} while (result.status !== "completed" && result.status !== "failed");

// Step 6: Get transaction hash
const details = await mcp.get_execution(execution.executionId);
console.log("Transaction hashes:", details.transactionHashes);
```

---

## Pattern 4: Direct Transfer with Preflight

```typescript
// ALWAYS simulate first
const sim = await mcp.execute_transfer({
  chain_id: "8453",           // Base mainnet
  to_address: "0xRecipient",
  amount: "0.05",
  simulate: true              // boolean, NOT string
});

if (sim.success && !sim.wouldRevert) {
  const tx = await mcp.execute_transfer({
    chain_id: "8453",
    to_address: "0xRecipient",
    amount: "0.05",
    idempotency_key: myUniqueKey  // same key on retry
  });

  // Poll
  let status;
  for (let i = 0; i < 10; i++) {
    await sleep(3000);
    status = await mcp.get_direct_execution_status(tx.executionId);
    if (status.status === "completed" || status.status === "failed") break;
  }
  console.log("TX hash:", status.transactionHash);
} else {
  // Handle preflight failure
  if (sim.code === "insufficient_balance") {
    console.log("Not enough balance to cover gas + transfer");
  }
}
```

---

## Pattern 5: Cold-Start Retry

```typescript
const IDEMPOTENCY_KEY = crypto.randomUUID();
let workflow;

for (let attempt = 0; attempt < 3; attempt++) {
  try {
    workflow = await mcp.create_workflow({
      name: "My Workflow",
      nodes, edges,
      idempotency_key: IDEMPOTENCY_KEY  // SAME KEY on every retry
    });
    break; // success
  } catch (err) {
    if (err.code === "upstream_cold_start" && attempt < 2) {
      const waitMs = (err.retryAfterSeconds ?? 5) * 1000;
      await sleep(waitMs * Math.pow(1.5, attempt));
    } else {
      throw err;
    }
  }
}
```

---

## Pattern 6: Protocol Action Discovery + Execute

```typescript
// Search for available DeFi actions
const actions = await mcp.search_protocol_actions({ protocol: "morpho" });
// Returns list of actionType strings like "morpho/supply", "morpho/withdraw"

// Execute one
const result = await mcp.execute_protocol_action({
  actionType: "morpho/supply",
  chain_id: "8453",
  params: {
    market: "0xMorphoMarketAddress",
    amount: "1000000"  // USDC in 6 decimals
  },
  simulate: true  // preflight first
});
```

---

## Pattern 7: Marketplace Workflow as MCP Tool

```bash
# List a workflow on marketplace
# Returns a slug for the workflow

# Install as narrow MCP server (one typed tool, better selection)
claude mcp add --transport http --scope user my-defi-workflow \
  https://app.keeperhub.com/mcp/w/my-defi-workflow-slug \
  --header "Authorization: Bearer kh_your_key"

# Now agent sees a single tool: "my-defi-workflow" with real input schema
# No search_workflows step needed, no call_workflow indirection
```

---

## Chain ID Quick Reference

Always pass as strings:

```typescript
const CHAINS = {
  ethereum: "1",
  sepolia: "11155111",
  base: "8453",
  baseSepolia: "84532",
  arbitrum: "42161",
  polygon: "137",
  solanaMainnet: "101",  // no simulate support
  solanaDevnet: "103"    // no simulate support
};
```

---

## Error Patterns

```typescript
// All MCP tool errors return:
// { content: [{ type: "text", text: "Error: <message>" }], isError: true }

// REST API errors:
// { error: { code: string, message: string, details?: any } }

// Simulate-specific errors:
interface SimulateError {
  success: false;
  wouldRevert: boolean;        // true if EVM reverted
  code?: string;               // e.g. "insufficient_balance"
  failureKind?: "revert" | "validation";
}

// Cold-start error:
interface ColdStartError {
  code: "upstream_cold_start";
  retryAfterSeconds: number;
  message: string;
}
```

---

## Template Reference

Node output references use:
```
{{@nodeId:Node Label.fieldName}}
```

Examples:
```
{{@check-balance:Check Balance.balance}}
{{@read-price:Read Price.answer}}
{{@trigger-1:Webhook.body.amount}}
{{@supply-tx:Aave Supply.transactionHash}}
```

---

## Condition Node Reference

```json
{
  "id": "cond-1",
  "type": "condition",
  "data": {
    "label": "Price Below Threshold",
    "type": "condition",
    "config": {
      "conditions": [
        {
          "leftValue": "{{@price-read:Read Price.answer}}",
          "operator": "<",
          "rightValue": "2000"
        }
      ],
      "logicalOperator": "AND"
    },
    "status": "idle"
  }
}
```

Edges from condition node MUST include `sourceHandle`:
```json
{ "source": "cond-1", "target": "buy-node", "sourceHandle": "true" }
{ "source": "cond-1", "target": "skip-node", "sourceHandle": "false" }
```
