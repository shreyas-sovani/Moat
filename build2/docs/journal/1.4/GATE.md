# Gate 1.4 verdict

| AC | Result | Evidence |
|---|---|---|
| AC1 == fires, 110.01 does not | SAT | `tests.txt` |
| AC2 Infinity fires, NaN throws | SAT | same |
| AC3 fire-point 80→27.27; r0≥trigger→0; r0=10→50 | SAT against **formula**. Backlog also wrote `r0=105→0` which contradicts the formula (yields 4.55); tests follow the formula. |
| AC4 monotonicity | SAT | same |
| AC5 d=50 and d=-1 throw | SAT | same |

**Verdict: PASS** (AC3 interpreted via the formula + 80→27.27 case, as noted in BACKLOG).
