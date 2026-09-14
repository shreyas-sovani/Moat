# Handoff — next agent (2026-09-14)

Read in order: `CLAUDE.md` → `docs/PRD.md` → `docs/BACKLOG.md` → this file → `docs/STATUS.md` → `build2/docs/journal/PROGRESS.md` → `build2/docs/journal/BLOCKED.md`.

**Network of record:** Base Sepolia `"84532"` only. No mainnet. No real funds. All runtime onchain writes through `packages/kh`.

## What this session closed

- Root `.env` and `build2/.env` reformatted to `KEY=value` (gitignored). Models: `COMPOSER_MODEL=gemini-2.5-flash`, `CRITIC_MODEL=gemini-2.5-flash-lite`, `GEMINI_API_KEY` set. Anthropic unused.
- Guardian funded: **0.08 ETH**, **50 USDC**, **0 WETH**. More faucets expected.
- Telegram: KH integration `m2ovhyo51qj0ixr3pl3dq`, bot `@moat69bot`, live send `message_id=4`, KH test 200. Chat id only in `.env`.
- GitHub repo exists: `https://github.com/shreyas-sovani/Moat` (public, empty default branch). **Local `origin` was missing** — add + push only if operator confirms. Local branch is `master`; operator previously wanted `git branch -M main`.
- OrbStack Docker is up. `act` is **not** installed. 0.2 AC1 still needs `act push` or a real `gh run` after first push.

**Not started this session (do not skip into these until 0.5 seed):** Phase 2 evidence closeout, worker/composer UI, Morpho market create.

## Env files (never commit)

Both `/.env` and `/build2/.env` must contain: `KEEPERHUB_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, flash model names. `build2/.env.example` has the names without secrets.

## Verified constants (do not invent new ones)

See `build2/config/verified.json`. Guardian `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`. WETH `0x4200000000000000000000000000000000000006`. USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Morpho Blue `0xBBBB…FFCb`. `markets: []`.

Python urllib to KeeperHub = Cloudflare 1010. Use Node `fetch`.

`validate_workflow` REST = 405; MCP-only; local `validateGraphJson` then `create_workflow`.

## Next block (operator must confirm)

1. Wait for extra ETH/USDC **or** proceed with 0.08 / 50?
2. Wrap ETH→WETH via KH `simulate: true` then broadcast.
3. Create permissionless WETH/USDC Morpho market (T1); seed supply+borrow ~70% of LLTV; record market id + ≥2 tx hashes.
4. Drop `build2/docs/journal/vt1/screenshot.png` of Telegram message 4.
5. `git remote add origin https://github.com/shreyas-sovani/Moat.git` if missing; then `git push` (ask: keep `master` or rename `main`?).
6. Then Phase 2 gates 2.1–2.3 (graph tests + `pnpm --filter @moat/kh smoke`).

## Quality

`pnpm lint && pnpm test && pnpm build` from `build2/` (PATH needs `~/.local/bin` for pnpm). Forbidden-token grep after `rm -rf apps/web/.next`.
