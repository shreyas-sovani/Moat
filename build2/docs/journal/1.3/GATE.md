# Gate 1.3 verdict

| AC | Result | Evidence |
|---|---|---|
| AC1 five ratio cases to 1e-6 | SAT | `ac1-ac3-tests.txt` |
| AC2 live Phase-0 position hand-computation | **UNSAT / BLOCKED** | No seeded market (Task 0.5 / B-001). Existing test records the live unfunded guardian: borrow 0 → ratio 0. Not a substitute for 0.5 AC4 arithmetic. |
| AC3 borrow-up / collateral-down when floor≠ceil | SAT | `rounds borrow up and collateral down when floor != ceil` |

**Verdict: FAIL (AC2 blocked on 0.5).** Unit math is otherwise complete.
