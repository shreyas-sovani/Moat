# Agent instructions

You are picking up **Moat** (KeeperHub hackathon, Base Sepolia only).

1. Read **`docs/CONTEXT.md` first** — live constants, gate dashboard, KH/Morpho gotchas, next block.
2. Then `CLAUDE.md`, `docs/PRD.md`, `docs/BACKLOG.md`. Live `verified.json` + journal win on conflict.
3. Work the next gated task in order (currently Phase **2.1 → 2.2 → 2.3**). Do not create a new Morpho market.
4. Before finishing: update `docs/CONTEXT.md`, `docs/STATUS.md`, `docs/HANDOFF.md`, `build2/docs/journal/PROGRESS.md`, `BLOCKED.md`, and the task journal. Stale docs are a defect.
5. Never commit `.env`. Never mainnet. All runtime writes through KeeperHub (`simulate: true` boolean first).
