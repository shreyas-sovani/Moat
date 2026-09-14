# KeeperHub MCP Tools — Authoritative Reference

> **Moat:** Cursor often has no KeeperHub MCP connected. Use REST + `KEEPERHUB_API_KEY`. Live REST map and 405-on-validate: `docs/CONTEXT.md`.

Source: https://docs.keeperhub.com/ai-tools/mcp-server  
(Also available at runtime via `tools_documentation` MCP tool)

## Connection Endpoints

| Endpoint | Purpose |
|---|---|
| `https://app.keeperhub.com/mcp` | Aggregate server (30+ tools) |
| `https://app.keeperhub.com/mcp/w/<slug>` | Per-workflow narrow server (1 tool) |

## Authentication Methods

| Method | Details |
|---|---|
| OAuth 2.1 | Browser flow; 1-hr access token, 30-day refresh. Claude Code: run `/mcp` after adding server. |
| API Key | `Authorization: Bearer kh_<key>` — create at app.keeperhub.com → Settings → Developer → API keys → Organisation keys |

## All 30+ Tools

### Workflow Management Tools

#### `list_workflows`
List workflows in the current organization.
- Optional: `projectId` (string) — filter by project
- Optional: `tagId` (string) — filter by tag
- Returns: array of workflow objects

#### `get_workflow`
Get a specific workflow by ID.
- Required: `id` (string)

#### `create_workflow`
Create a new workflow.
- Required: `name` (string), `nodes` (array), `edges` (array)
- Optional: `enabled` (boolean, default: `true`), `description`, `projectId`, `tags`
- Always use: `idempotency_key` (string) — required for safe retries on cold-start
- Returns: created workflow object with `id`

#### `update_workflow`
Update an existing workflow.
- Required: `id` (string)
- Optional: any workflow fields to update
- Disable: `{ id, enabled: false }`

#### `delete_workflow`
Permanently delete a workflow.
- Required: `id` (string)

#### `validate_workflow`
Validate workflow schema before creation.
- Required: `nodes` (array), `edges` (array)
- Returns: `{ valid: boolean, errors: string[] }`
- **Always call before `create_workflow`**

#### `prepare_test_pin_data`
Pin test data for trigger nodes (for dry-run testing).
- Required: `workflowId`, `nodeId`, `data` (object)

#### `validate_cron`
Validate a cron expression.
- Required: `expression` (string)

#### `ai_generate_workflow`
Generate a workflow from a natural language description.
- Required: `description` (string)
- Subject to cold-start errors — use `idempotency_key`

### Execution Tools

#### `execute_workflow`
Execute a workflow by ID.
- Required: `id` (string)
- Optional: `inputs` (object) — for Webhook/Manual triggers with input schema
- Returns: `{ executionId: string }`
- **No timeout** — on-chain work runs to completion

#### `get_execution`
Get full execution details.
- Required: `executionId` (string)
- Returns: execution object with `transactionHashes` array, status, logs

#### `get_execution_status`
Poll execution status (lightweight).
- Required: `executionId` (string)
- Returns: `{ status: "running" | "completed" | "failed" | "pending" }`

#### `get_execution_logs`
Get log lines for an execution.
- Required: `executionId` (string)

#### `list_executions`
List past executions.
- Optional: `workflowId` (filter), pagination params

#### `call_workflow`
Call a marketplace-listed workflow by its slug.
- Required: `slug` (string), `inputs` (object matching workflow's input schema)
- **No timeout**
- Returns 402 if paid — agentic wallet intercepts and handles

### Direct On-Chain Execution Tools

#### `execute_transfer`
Direct ETH or token transfer (no workflow needed).
- Required: `chain_id` (string), `to_address` (string), `amount` (string)
- Optional: `simulate` (boolean) — preflight without broadcast; `idempotency_key` (string)
- **No timeout**
- `simulate: true` → returns `{ success, wouldRevert, ... }` — NO tx hash
- Simulation is EVM-only (not chain IDs `101`/`103`)

#### `execute_contract_call`
Direct contract write call (no workflow needed).
- Required: `chain_id`, `contractAddress`, `abi`, `abiFunction`
- Optional: `params` (array), `value` (ETH to send), `simulate`, `idempotency_key`
- **No timeout**

#### `execute_check_and_execute`
Read an onchain value, compare it, then conditionally execute.
- Required: `chain_id`, `contractAddress`, `abi`, `abiFunction`, comparison `operator`, `value`, action config
- Operators: `eq`, `neq` for addresses/bytes; comparison operators for numbers
- Optional: `simulate`, `idempotency_key`
- **No timeout**

#### `get_direct_execution_status`
Poll status of a direct execution.
- Required: `executionId` (string)
- Returns: `{ status: "pending" | "completed" | "failed", transactionHash?: string }`
- **No timeout**
- Poll with bounded backoff until `completed` or `failed`

### Protocol Action Tools (DeFi)

#### `search_protocol_actions`
Find available DeFi actions.
- Optional: `protocol` (e.g. `"aave-v3"`), `actionType`, `query`
- Returns: list of action descriptors with `actionType` strings

#### `execute_protocol_action`
Execute a named DeFi protocol action.
- Required: `actionType` (e.g. `"aave-v3/supply"`), `chain_id`, `params`
- Optional: `simulate`, `idempotency_key`
- **No timeout**

### AI Generation & Discovery Tools

#### `ai_generate_workflow`
Generate a workflow from natural language.
- Required: `description` (string)
- Subject to cold-start — use `idempotency_key`

#### `list_action_schemas`
Get all available action types with their full input schemas.
- Optional: `category` (string), `status`
- **Call this to discover valid `actionType` values before building workflows**
- Always authoritative — reflects current platform state

#### `get_plugin`
Get details for a specific plugin.
- Required: `id` (string)

#### `search_plugins`
Search available plugins.
- Required: `query` (string)

#### `search_templates`
Search workflow templates.
- Required: `query` (string)

#### `deploy_template`
Deploy a template to your organization.
- Required: `templateId` (string)
- Returns: created workflow

#### `get_template`
Get a workflow template.
- Required: `id` (string)

### Marketplace Tools

#### `search_workflows`
Search marketplace-listed workflows.
- Required: `query` (string)
- Returns: listed workflows with slugs and input schemas

#### `list_workflow`
Publish a workflow to the marketplace.
- Required: `workflowId`, `slug` (string, URL-safe), `description`, `inputSchema`

#### `unlist_workflow`
Remove a workflow from the marketplace.
- Required: `workflowId`

#### `update_workflow_listing`
Update listing metadata.
- Required: `workflowId`
- Optional: `description`, `inputSchema`, `price`

#### `get_workflow_listing`
Get marketplace listing details.
- Required: `workflowId`

### Agent Utility Tools

#### `get_spending_limits`
Get the current agent's spending thresholds.
- Returns: limit configuration for the connected agent

#### `test_notification`
Test a notification connection (Telegram, Discord, etc.).
- Required: `connectionId` (string)

#### `tempo_sign_and_hold`
Sign a transaction but hold broadcast until `tempo_release_hold`.
- Requires `mcp:write` scope
- Use for time-locked execution patterns

#### `tempo_cancel_hold`
Cancel a held (not yet broadcast) transaction.
- Required: `holdId` (string)

#### `tempo_release_hold`
Broadcast a held transaction.
- Required: `holdId` (string)

#### `get_wallet_integration`
Confirm wallet is configured for the current organization.
- **Call before any write action**
- Returns wallet configuration or null

#### `list_integrations`
List all integrations configured for the organization.

#### `tools_documentation`
Get authoritative, always-current documentation for all MCP tools.
- **Call this first in any agent session**
- Returns the full tools reference as text

## MCP Resources

| URI | Description |
|---|---|
| `keeperhub://workflows` | List all workflows |
| `keeperhub://workflows/{id}` | Get a specific workflow |

## Per-Workflow Server vs Aggregate Server

| | Aggregate (`/mcp`) | Per-workflow (`/mcp/w/<slug>`) |
|---|---|---|
| Tool count | 30+ | 1 |
| Tool name | `call_workflow(slug, inputs)` | Named after workflow slug |
| Input schema | Generic `inputs: object` | Real typed schema |
| LLM selection | Requires discover-then-call dance | Single turn, no ambiguity |
| Cross-org calls | Only own org | Any listed workflow |

Use the per-workflow server when you want an agent to call a specific workflow reliably in one turn.

## Timeout Behavior

**55-second timeout applies to all tools EXCEPT:**
- `execute_workflow`
- `execute_transfer`
- `execute_contract_call`
- `execute_check_and_execute`
- `execute_protocol_action`
- `call_workflow`
- `get_direct_execution_status`

These disable the timeout so on-chain work completes without being aborted.

## Scope Control

Agent permissions are the lower of:
- What the agent's OAuth token allows
- What the organization's admin has set as the agent's limit

Lowering a limit takes effect within ~1 minute without reconnecting.
`403 insufficient_scope` is returned if a call exceeds the limit.

## Organization Scoping

Each MCP connection serves exactly one organization:
- OAuth: org active in browser when you authorized
- API key: org the key was created in

To work across multiple orgs: add separate MCP server entries, one per org.
