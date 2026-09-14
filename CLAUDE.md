# CLAUDE.md — KeeperHub Integration Project

This file is read by Claude Code automatically. It provides project-specific context and rules.

**Moat live state (read first):** `docs/CONTEXT.md`. Dashboard: `docs/STATUS.md`. Pickup: `docs/HANDOFF.md`. Network of record is Base Sepolia `"84532"` — **not** `"8453"`. Composer env is Gemini Flash, not Anthropic. Do not invent Morpho market ids.

## Project Context

This is a KeeperHub hackathon integration project. KeeperHub is the deterministic onchain execution and reliability layer for AI agents. All onchain value movement in this project MUST go through KeeperHub.

## KeeperHub Skill

Read `docs/agent-skills/SKILL.md` before writing any KeeperHub integration code.
Read `docs/agent-skills/mcp-tools-reference.md` for the complete MCP tool API.
Read `docs/agent-skills/workflow-patterns.md` for concrete code patterns.
Read `docs/analysis.md` for the full ecosystem analysis and hackathon context.

## MCP Server

The KeeperHub MCP server is at: `https://app.keeperhub.com/mcp`

To connect in Claude Code:
```bash
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp
# Then run /mcp to complete OAuth
```

## Hard Rules for Code Generation

1. **ALL onchain writes go through KeeperHub** — never use ethers.js `sendTransaction`, `writeContract`, or similar directly for value movement.
2. **Always call `validate_workflow` before `create_workflow` when MCP validate is available.** Live REST `POST /api/workflows/validate` is **405** (MCP-only, needs stored workflowId). Workaround: local `validateGraphJson` then `create_workflow`. Do not invent a REST validate path.
3. **Always call `get_wallet_integration` before any write action**
4. **Always use `simulate: true` (boolean) before broadcasting direct executions**
5. **Always use `idempotency_key` on create/execute calls for safe retries**
6. **Chain IDs are strings**: `"84532"` for this project (skill samples often show `"8453"` — that is Base **mainnet** and is **forbidden** here)
7. **`simulate` is boolean**: `true` not `"true"`
8. **Always call `tools_documentation` at the start of an agent session**
9. **Condition node edges MUST include `sourceHandle: "true"` or `"false"`**

## Architecture Pattern

```
[External Event/Trigger]
  → [Agent reads intent]
  → [list_action_schemas] (discover available actions)
  → [validate_workflow] (validate before create)
  → [create_workflow] (with idempotency_key)
  → [execute_workflow]
  → [poll get_execution_status]
  → [get_execution] (for transactionHashes)
  → [Surface tx hash + audit trail to user]
```

## Hackathon Submission Requirements

1. Transaction hash from a KeeperHub execution
2. Demo video showing the integration working
3. Public source code repository

KeeperHub surfaces to use (mention in submission form):
- MCP Server ✓
- Audit trail (get_execution_logs) ✓
- Dry-run/simulate ✓
- DeFi plugins ✓
- x402/MPP (optional but impressive)

## Key Links

- Docs: https://docs.keeperhub.com/
- MCP Guide: https://docs.keeperhub.com/ai-tools/mcp-server
- GitHub: https://github.com/keeperhub/keeperhub
- Discord: https://discord.gg/keeperhub
