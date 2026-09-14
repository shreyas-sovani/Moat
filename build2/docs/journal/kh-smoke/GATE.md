# Gate 2.3 verdict

Evaluated 2026-09-14 against `docs/BACKLOG.md` Task 2.3.

Live REST `POST /api/workflows/validate` is 405. Smoke uses local `validateGraphJson` then `createWorkflow` (`enabled: false`). Notify `chatId` from `TELEGRAM_CHAT_ID` (redacted in journal). Condition node is KH `type: "action"` + `actionType: "Condition"`.

Idempotency `moat:smoke:2026-09-14`. First run created `4nejcqnx21wsfxquxosk0` (listed, then deleted). Second run: same key → same id, **not** in `GET /api/workflows` (3 pre-existing workflows only) — no duplicate.

| AC | Result | Evidence |
|---|---|---|
| AC1 exit 0 with workflow id | SAT | `run1/summary.json` id `4nejcqnx21wsfxquxosk0` |
| AC2 rerun no duplicate | SAT | `run2/summary.json` same id, `idempotentReplay: true`, `list-ids.json` count 3 without that id |
| AC3 validate + create in journal | SAT | `run1/validate.json` (local `validateGraphJson`), `run1/create.json`, `run1/delete.json` `{success:true}` |

**Verdict: PASS**
