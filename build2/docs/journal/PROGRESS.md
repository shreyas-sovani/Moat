# Implementation progress

Format: `TASK <id> | PASS|FAIL|BLOCKED <iso-date> | <digest>` plus `REWORK` lines per BACKLOG §0.3.

TASK 0.1 | PASS 2026-09-14T09:37:18Z | green monorepo: 8 workspaces, biome 50 files, 40 tests, turbo 8/8 build; lint stays green after next build by ignoring generated dirs
REWORK 1 | AC1 | F1 | biome formatted dist/.turbo/.next-web after tsc/next emit | files.include whitelist + ignore dist/.next/.turbo/.next-web; delete stray src JS emit
REWORK 2 | AC5 | F1 | Next 15 `.next/types` contains generated `any` | evaluate exact grep on source after `rm -rf apps/web/.next` (gitignored); do not treat generated types as product source

TASK 0.2 | PASS 2026-09-14T17:40:00Z | GitHub Actions ci run 34875987566 lint+build+test green on main
TASK 0.3 | PASS 2026-09-14T09:42:52Z | 488 actions dumped; sync:schemas idempotent on fetchedAt; relative schema path resolved from repo root
REWORK 1 | AC4 | F1 | ACTION_SCHEMAS_PATH=./config/... resolved against packages/infra cwd | resolve relative env paths against REPO_ROOT
TASK 0.4 | PASS 2026-09-14T09:44:00Z | REST map live-probed; validate_workflow MCP-only (405); spendCap GET /api/analytics/spend-cap 200
TASK 0.5 | PASS 2026-09-14T17:34:53Z | T1 WETH/USDC market 0x8cf9d4da…0e0d; oracle 0x274CC0f5…0490; LLTV 91.5e16; supply+borrow txs; ratio 70.5% of LLTV
TASK 0.6 | PASS 2026-09-14T17:34:53Z | Telegram screenshot journal/vt1/screenshot.png; adversary=same guardian
TASK 1.1 | PASS 2026-09-14 | verified.json Zod + check-config; no extra readers
TASK 1.2 | PASS 2026-09-14 | assetsFromShares table + property; bigint-only
TASK 1.3 | PASS 2026-09-14T17:34:53Z | live AC4 numbers in position-risk.test.ts (70.526009% of 91.5% LLTV)
TASK 1.4 | PASS 2026-09-14 | breach/fire-point/stress; formula wins over 105→0 clause
TASK 1.5 | PASS 2026-09-14 | policy schema + 27 risk/policy tests
TASK 2.1 | PASS 2026-09-14T18:05:00Z | graph I1–I6 dedicated tests vs real dump; KH Condition is actionType Condition; AC4 via kh-smoke create
TASK 2.2 | PASS 2026-09-14T18:05:00Z | REST client 11 tests: retry, cold_start key, 400, chain guard, idempotency, KhUnsupportedError, workflowRows
TASK 2.3 | PASS 2026-09-14T18:05:00Z | smoke create 4nejcqnx21wsfxquxosk0 then delete; rerun same key → same id, not listed (no duplicate)
TASK 3.1 | PASS 2026-09-14T18:05:00Z | migration 20260914180000_init committed; seed inserts 10 models; grep -c model = 10
TASK 3.2 | NOT STARTED | next — viem reads of existing market only
