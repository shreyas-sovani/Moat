# Gate 1.3 verdict

| AC | Result | Evidence |
|---|---|---|
| AC1 five ratio cases to 1e-6 | SAT | `ac1-ac3-tests.txt` |
| AC2 live Phase-0 position hand-computation | SAT | `packages/risk/src/position-risk.test.ts` comment + test uses Task 0.5 AC4 numbers (borrow 31e6, collateral_loan 48038705, lltv 91.5e16 → 70.526009%) |
| AC3 borrow-up / collateral-down when floor≠ceil | SAT | `rounds borrow up and collateral down when floor != ceil` |

**Verdict: PASS** after Task 0.5 T1 seed (2026-09-14T17:34:53Z).
