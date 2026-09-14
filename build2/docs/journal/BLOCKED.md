# Blocked queue

Escalate here after 2 failed rework cycles, or immediately when a verification step cannot proceed without an external resource.

## OPEN

### B-004 | CLAUDE.md `validate_workflow` vs live REST

- `POST /api/workflows/validate` → 405. `mcpOnly: ["validate_workflow"]`.
- Workaround: local `validateGraphJson` then `create_workflow`.

### B-005 | `kh` CLI missing

- Chain catalog via `GET /api/chains`. Optional.

### B-006 | Task 0.2 AC1 | no gh run until first push

- Docker/OrbStack: OK. `act`: not installed. Public repo `https://github.com/shreyas-sovani/Moat` exists (empty default branch at last check).
- Close by pushing `main` and watching `gh run`.

### B-007 | KeeperHub 0.02 ETH daily native cap

- Wrap consumed 0.019 ETH. Further payable KH writes need cap reset or a higher org cap. ERC-20 Morpho calls are not native-capped.

## CLOSED

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
