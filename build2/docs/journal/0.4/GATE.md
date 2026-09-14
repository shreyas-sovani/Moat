# Gate 0.4 verdict

Evaluated 2026-09-14 against `docs/BACKLOG.md` Task 0.4.

| AC | Result | Evidence |
|---|---|---|
| AC1 every Req-1 operation in `restEndpointsConfirmed` or `mcpOnly` | SAT | `ac1-rest-map.txt` — validate is `mcpOnly`; create/execute/status/logs/directContractCall confirmed |
| AC2 ≥1 live HTTP status per probed path, none ≥ 500 | SAT | `ac2-probes.json` / `vk4/live-probes.json` (Node `fetch`; Python urllib is Cloudflare 1010) |
| AC3 `provenance.V-K2` filled | SAT | `config/verified.json` |

**Verdict: PASS.**
