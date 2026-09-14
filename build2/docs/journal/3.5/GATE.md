# Gate 3.5 verdict

Evaluated 2026-09-14T20:35Z against `docs/BACKLOG.md` Task 3.5 (MILESTONE).

Live adversary `withdrawCollateral` through KeeperHub `directContractCall` (`simulate: true` first, distinct idempotency keys), then watcher `executeWorkflow(ojxu9lcwdmb6bxl0mh5qm)` `supplyCollateral`. Morpho plugin unused (no 84532). Requested stress target was trigger+5=115, which is above Morpho LLTV — sized to Morpho-safe **99% of LLTV**. After withdraw, WETH returned to the wallet; ERC-20 `approve` to Morpho Blue was required before the save (seed allowance was consumed). KH execution status stayed `error` because the Telegram notify node lacks a bot token on the org integration; `top-up` node `success` with an onchain hash. Supervisor treats a successful write node as the run succeeding (notify-only failure). Reconciliation v0: after 68.61 vs projected ~68.69.

Command: `pnpm --filter @moat/worker drill`. Evidence: `docs/journal/run1/` + this folder.

| AC | Result | Evidence |
|---|---|---|
| AC1 ≥2 explorer-linked testnet hashes (drill + save) | SAT | `run1/tx-links.json`, `run1/summary.json`. Drill `0x5e57df2e…7ab9b`, save `0x821dbaef…1b8a`, plus approve `0x527f16ee…6585a`. `cast receipt` all `status=0x1` in `explorer-receipts.txt`. Basescan curl HEAD is Cloudflare 403; receipts are the chain proof. |
| AC2 Run succeeded + txHashes + logsJson + reconciledAt | SAT | `run1/run-final.json` id `cmu1p9tie0001y3ax9706dnv7`, `status=succeeded`, `txHashes` has the save hash, `logsJson` is the KH execution+logs export, `reconciledAt=2026-09-14T20:35:10.301Z`, KH execution `tbrw4sfnzjj9rmvglrnlt`. |
| AC3 after < before by ≥15 pct-points | SAT | `run1/ratios.json` before **99.221493** after **68.614935** delta **30.61**. |
| AC4 sweeps + suite green | SAT | forbidden-token and provenance greps empty on source; `pnpm lint && pnpm test && pnpm build`. Suite **89** tests. Re-verified 2026-09-14T20:40Z in `ac4-sweeps.txt` + `ac-tests.txt`. |

**Verdict: PASS**

### Live facts learned

- `executeWorkflow` JSON must not mix nested `{input:{}}` with top-level `idempotency_key`. Header `Idempotency-Key` only. Probe: `run1/execute-probe.json`.
- `web3/check-token-balance` human `balance.balance` vs wei `balance.balanceRaw`. Condition uses `balance.balanceRaw`.
- After `withdrawCollateral`, `supplyCollateral` needs a fresh WETH `approve` to Morpho Blue (`transferFrom reverted` otherwise). `run1/run-failed-transferFrom.json`.
- KH Telegram plugin on this org: "Telegram bot token is required" — write still landed. Configure the integration before the demo video if notify must succeed.
- Daily native cap unchanged: used 0.019 / 0.02 ETH (`run1/spend-cap.json`). Drill/approve/save were non-payable ERC-20 / Morpho calls.

### Do not reuse these idempotency keys

`moat:drill-sim:b35f4207-f43b-415e-802a-254fe29b7060`, `moat:drill:02a0956c-aa0b-4b9f-bcd1-e6ecce471949`, `moat:approve-sim:02e93973-bb2a-45f9-97ae-19064cdd4271`, `moat:approve:e54f4bec-cdca-4a32-a984-fa6de2ac0c09`, `moat:run:cmu1p9tie0001y3ax9706dnv7`.
