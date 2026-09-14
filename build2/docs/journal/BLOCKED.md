# Blocked queue

Escalate here after 2 failed rework cycles, or immediately when a verification step cannot proceed without an external resource.

## OPEN

### B-004 | CLAUDE.md `validate_workflow` vs live REST

- `POST /api/workflows/validate` → 405. `mcpOnly: ["validate_workflow"]`.
- Workaround: local `validateGraphJson` then `create_workflow`.

### B-005 | `kh` CLI missing

- Chain catalog via `GET /api/chains`. Optional.

### B-007 | KeeperHub 0.02 ETH daily native cap

- Wrap consumed 0.019 ETH. Remaining ~0.001 ETH native as of seed. Re-check `GET /api/analytics/spend-cap` before any payable KH write.

### B-008 | Task 2.3 smoke not run

- Script exists. REST validate 405 so smoke must use local `validateGraphJson`. Notify chatId `"0"` is wrong (`m2ovhyo51qj0ixr3pl3dq` / env chat id).

### B-009 | Task 3.1 no Prisma migrations

- 10 models + unit test exist. `packages/db/prisma/migrations` missing — Gate 3.1 AC1 would fail on a fresh clone.

## CLOSED

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
