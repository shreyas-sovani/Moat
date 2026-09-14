# Gate 1.1 verdict

| AC | Result | Evidence |
|---|---|---|
| AC1 fixture + reject 8453 + reject 1 | SAT | `ac1-ac2-tests.txt` |
| AC2 missing morpho.blue throws path | SAT | same file, `loadVerified` case |
| AC3 check-config.ts exit 0 | SAT | `ac3-check-config.txt` `{"ok":true,"chainId":"84532",...}` |
| AC4 grep verified.json outside infra | SAT | `ac4-grep.txt` empty |

**Verdict: PASS**
