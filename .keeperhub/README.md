# KeeperHub Configuration

## MCP Server Setup

### Option A: OAuth (browser-based, recommended)
```bash
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp
# Then run /mcp inside Claude Code to complete OAuth authorization
```

### Option B: API Key (headless/CI)
```bash
claude mcp add --transport http --scope user keeperhub https://app.keeperhub.com/mcp \
  --header "Authorization: Bearer kh_your_key_here"
```

Get your API key: app.keeperhub.com → Settings → Developer → API keys → Organisation keys

### Option C: Per-workflow narrow server (best LLM tool accuracy)
```bash
claude mcp add --transport http --scope user my-workflow \
  https://app.keeperhub.com/mcp/w/<workflow-slug> \
  --header "Authorization: Bearer kh_your_key_here"
```

## mcp.json Reference
The `mcp.json` file in this directory is a template for tool integrations (e.g. Cursor, custom agents).
Replace `kh_YOUR_API_KEY_HERE` with your actual org API key.

## Resources
- Docs: https://docs.keeperhub.com/
- MCP Guide: https://docs.keeperhub.com/ai-tools/mcp-server
- API Keys: https://app.keeperhub.com (Settings → Developer → API keys)
- Discord: https://discord.gg/keeperhub
