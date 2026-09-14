# Moat

Agent-guarded Morpho liquidation protection on **Base Sepolia** (testnet only). Built for the KeeperHub Agent Economy hackathon.

**Live pickup for coding agents:** start at [`docs/CONTEXT.md`](docs/CONTEXT.md). That file is the source of truth for what is done, what is next, and every live constant.

- Product contract: [`docs/PRD.md`](docs/PRD.md)
- Task gates: [`docs/BACKLOG.md`](docs/BACKLOG.md)
- Dashboard: [`docs/STATUS.md`](docs/STATUS.md)
- Public repo: https://github.com/shreyas-sovani/Moat

## Network of record

Base Sepolia `chainId` `"84532"`. No mainnet. No real funds. All runtime onchain writes go through KeeperHub.

Seeded Morpho WETH/USDC market and guardian position exist — **do not invent a market id**. See `build2/config/verified.json` and `docs/CONTEXT.md` §5.

## Monorepo

Code lives in `build2/` (pnpm + turbo). `bounty/` is a separate, not-started DoraHacks bounty entry.

```bash
export PATH="$HOME/.local/bin:$PATH"
cd build2
cp .env.example .env   # then fill secrets locally; never commit .env
pnpm install
pnpm lint && pnpm test && pnpm build
```

CI on `main`: GitHub Actions workflow at repo-root `.github/workflows/ci.yml` (`working-directory: build2`).
