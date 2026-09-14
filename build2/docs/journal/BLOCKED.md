# Blocked queue

Escalate here after 2 failed rework cycles, or immediately when a verification step cannot proceed without an external resource.

## OPEN

### B-004 | CLAUDE.md `validate_workflow` vs live REST

- `POST /api/workflows/validate` → 405. `mcpOnly: ["validate_workflow"]`.
- Workaround: local `validateGraphJson` then `create_workflow`. Smoke (2.3) used this path.

### B-005 | `kh` CLI missing

- Chain catalog via `GET /api/chains`. Optional.

### B-007 | KeeperHub 0.02 ETH daily native cap

- Wrap consumed 0.019 ETH. Remaining ~0.001 ETH native as of seed. Re-check `GET /api/analytics/spend-cap` before any payable KH write. Drill (3.5) should be Morpho `withdrawCollateral` via `web3/write-contract` (Morpho plugin does not list 84532), not wrap. Task 3.2 was reads-only (viem). Task 3.3 was mocked KH (no spend). Task 3.4 created workflow `ojxu9lcwdmb6bxl0mh5qm` (no native wrap).

## CLOSED

### B-011 | Morpho plugin no Base Sepolia | CLOSED 2026-09-14T20:20Z

Live `createWorkflow` 422: `morpho/supply-collateral` networks `1|8453|11155111`, not `"84532"`; `assets` must be uint256. Workaround: `web3/write-contract` `supplyCollateral`. Evidence `journal/3.4/kh-422-morpho-plugin.json`. 3.5 must not use `morpho/withdraw-collateral`.

### B-010 | CI migrate P1012 DATABASE_URL | CLOSED 2026-09-14T18:20Z

`gh run` 34878616724 failed P1012. Fix in `15454bf`. Confirmed green: [34879998395](https://github.com/shreyas-sovani/Moat/actions/runs/34879998395).

### B-009 | Task 3.1 no Prisma migrations | CLOSED 2026-09-14T18:05Z

Migration `20260914180000_init` committed. `prisma migrate status` up to date. Seed script + test.

### B-008 | Task 2.3 smoke not run | CLOSED 2026-09-14T18:05Z

Live smoke PASS. Workflow `4nejcqnx21wsfxquxosk0` created, listed, deleted. Notify used `TELEGRAM_CHAT_ID` (schema requires `chatId`, not `"0"`).

### B-006 | Task 0.2 AC1 | CLOSED 2026-09-14T17:40Z

`gh run` 34875987566 green on `main`.

### B-001 | Task 0.5 V-M1 T1-pending | CLOSED 2026-09-14T17:34:53Z

Market + seed complete. Market id in `verified.json`.

### B-002 | Task 0.6 AC2 photo | CLOSED 2026-09-14

`journal/vt1/screenshot.png` present.

### B-003 | Task 0.6 adversary wallet | CLOSED 2026-09-14

Operator: same guardian wallet.

### B-002 original (no telegram integration) | CLOSED 2026-09-14

Telegram connection now present and testable.

### B-003 original (zero faucet balances) | CLOSED 2026-09-14

Guardian funded and position seeded.
