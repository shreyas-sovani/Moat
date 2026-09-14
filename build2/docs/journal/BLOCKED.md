# Blocked queue

Escalate here after 2 failed rework cycles, or immediately when a verification step cannot proceed without an external resource.

## OPEN

### B-001 | Task 0.5 V-M1 | T1-pending market — funds started, not seeded

- Live 2026-09-14T16:50Z: guardian ETH=0.08, USDC=50, WETH=0. Morpho Blue HAS_CODE. `markets: []`.
- Operator: more ETH/USDC coming (faucet limit). **Paused before wrap/market/seed.**
- Decision needed from operator: proceed with current balances, or wait for more?
- Runtime writes must go through KeeperHub (`simulate: true` first). Do not guess a market id.

### B-002 | Task 0.6 AC2 photo | screenshot of Telegram message 4

- API: KH test 200; bot sendMessage `message_id=4` to private chat. Bot `@moat69bot`. Integration `m2ovhyo51qj0ixr3pl3dq`.
- Missing: `build2/docs/journal/vt1/screenshot.png`. Drop it to close AC2 camera evidence.

### B-003 | Task 0.6 adversary wallet

- Only guardian funded. PRD allows same KH wallet as drill attacker. Confirm: no second wallet, or fund one and send address.

### B-004 | CLAUDE.md `validate_workflow` vs live REST

- `POST /api/workflows/validate` → 405. `mcpOnly: ["validate_workflow"]`.
- Workaround: local `validateGraphJson` then `create_workflow`.

### B-005 | `kh` CLI missing

- Chain catalog via `GET /api/chains`. Optional.

### B-006 | Task 0.2 AC1 | no act, no local origin, no push

- Docker/OrbStack: OK. `act`: not installed. GitHub repo `https://github.com/shreyas-sovani/Moat` exists (public, empty default branch).
- Local `git remote -v` empty. Operator previously listed `git remote add origin …` and `git branch -M main` + push.
- Decision: add origin + push (`master` vs `main`)? Install `act`?

## CLOSED

### B-002 original (no telegram integration) | CLOSED 2026-09-14

Telegram connection now present and testable.

### B-003 original (zero faucet balances) | CLOSED-PARTIAL 2026-09-14

Guardian no longer zero. WETH still 0 until wrap. More tokens expected.
