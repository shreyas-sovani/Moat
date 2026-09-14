# Gate 2.1 verdict

Evaluated 2026-09-14 against `docs/BACKLOG.md` Task 2.1.

Live KH schema (`docs.keeperhub.com/workflows/schema-reference`) only allows node `type: "trigger" | "action"`. Condition nodes are `type: "action"` + `actionType: "Condition"` with `config.group.rules` (`leftOperand` / `operator` / `rightOperand`). Builder emits that shape. `validateGraphJson` I2 also accepts legacy `type: "condition"`.

| AC | Result | Evidence |
|---|---|---|
| AC1 I1–I6 vs real `action-schemas.json` | SAT | `tests.txt`, `ac1-ac3-tail.txt` — 8 dedicated tests |
| AC2 trigger→read→condition→true/false→notify | SAT | same; condition node is KH `actionType: "Condition"` |
| AC3 mutation tests name I1–I6 | SAT | dedicated I1–I6 throw tests |
| AC4 KH-side validation | SAT | `journal/kh-smoke/run1/create.json` HTTP-success create of builder graph; local validate only (`validate_workflow` REST 405) |

**Verdict: PASS** (AC4 filled by Task 2.3 live create).
