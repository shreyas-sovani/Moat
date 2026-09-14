# Blocked queue

Escalate here after 2 failed rework cycles, or immediately when a verification step cannot proceed without an external resource.

## OPEN

### B-001 | Task 0.5 V-M1 | T1-pending market + unfunded guardian

- Tried: `cast code` on Morpho Blue `0xBBBB…FFCb`, IRM, oracle factory on `https://sepolia.base.org` — all HAS_CODE. Morpho GraphQL `chainId 84532` returns unsupported (no indexed markets). Guardian `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758` ETH/USDC/WETH balances are 0.
- Blocker: cannot create a permissionless WETH/USDC market or seed a position until the KeeperHub org wallet has Base Sepolia ETH + Circle USDC (and WETH wrap). Runtime writes must go through KeeperHub (`simulate: true` first).
- Decision needed: fund the guardian via Circle + Coinbase/L2 faucets, then resume T1 market create. Do not guess a market id.
- Fallback if Base Sepolia stays unusable: T2 Ethereum Sepolia `11155111` (already in CHAIN_ALLOWLIST).

### B-002 | Task 0.6 V-T1 | no notification integration

- Tried: `GET /api/integrations` — only the web3 wallet integration is present.
- Blocker: `telegram/send-message` exists in action-schemas but there is no Telegram/Discord connection on the org. `test_notification` cannot be proven.
- Decision needed: connect Telegram (preferred) or Discord in the KeeperHub org, then rerun V-T1.

### B-003 | Task 0.6 V-F1 | faucets

- Same wallet as B-001. Need ETH + USDC + collateral (WETH; cbBTC mainnet address has no code on Base Sepolia).
- Adversary wallet not created yet.

### B-004 | CLAUDE.md `validate_workflow` vs live REST

- `POST /api/workflows/validate` → 405. Live flag: `verified.json.keeperhub.mcpOnly = ["validate_workflow"]`.
- MCP `validate_workflow` validates a **stored** workflow by id, not an in-memory graph.
- Workaround in `packages/kh`: local `validateGraphJson` (I1–I6) before `create_workflow`; `validateWorkflow()` throws `KhUnsupportedError`.
- Not a product halt. Documented so agents do not invent a REST validate path.

### B-005 | `kh` CLI missing

- `kh chain list` is not installed. Chain catalog was proven via `GET /api/chains` (200). Recorded in `journal/vk1/kh-chain-list.md`.

### B-006 | Task 0.2 AC1 | no act / Docker / remote

- Tried: `which act` → not found. `docker info` → unavailable. `git remote -v` → empty. `gh run` needs a GitHub remote.
- Blocker: cannot produce an Actions run log from this machine.
- Decision needed: install Docker + `act`, or create a GitHub remote and push (not done unless asked). Local `pnpm lint && pnpm build && pnpm test` already green.
- YAML is committed so the first real push will exercise AC1.

(none yet)
