# Gate 2.2 verdict

Evaluated 2026-09-14 against `docs/BACKLOG.md` Task 2.2.

REST `POST /api/workflows/validate` remains 405 (`mcpOnly: ["validate_workflow"]`). Client `validateWorkflow` rejects with `KhUnsupportedError` (async). List helper `workflowRows` accepts a bare array (live `GET /api/workflows`) or `{ workflows: [...] }`.

| AC | Result | Evidence |
|---|---|---|
| AC1 503→200 in exactly 2 attempts | SAT | `tests.txt` |
| AC2 cold_start same Idempotency-Key | SAT | same |
| AC3 400 → KhApiError, 1 attempt | SAT | same |
| AC4 `assertChainAllowed("8453")` throws; `"84532"` passes; mutating `directContractCall` on 8453 does not fetch | SAT | same |
| AC5 `idempotencyKey("run","r-123")` → `moat:run:r-123` | SAT | same |
| AC6 ≥8 green tests in package | SAT | `ac6-tail.txt` **11 passed** in `rest.test.ts` (kh package total 19 with graph) |

**Verdict: PASS**
