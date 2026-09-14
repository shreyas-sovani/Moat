# Gate 0.5 — Morpho market + seeded position

Evaluated 2026-09-14T17:34:53Z. Testnet only. No mainnet. No real funds.
All writes via KeeperHub `POST /api/execute/contract-call` with `simulate: true` first.

## Branch

**T1** on canonical Morpho Blue already deployed at `0xBBBB…FFCb`. IRM enabled. `isLltvEnabled(910000000000000000)=false`; closest enabled Morpho LLTV is **91.5%** (`915000000000000000`).

## AC1 verified.json.morpho

Market recorded:

| Field | Value |
|---|---|
| id | `0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d` |
| collateral | WETH `0x4200000000000000000000000000000000000006` |
| loan | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| lltv | `915000000000000000` |
| oracle | `0x274CC0f59661d3F49aE09231C9B821bc874d0490` (factory `isMorphoChainlinkOracleV2=true`) |
| irm | `0x46415998764C29aB2a25CbeA6254146D50D22687` |

`idToMarketParams` matches. Provenance `V-M1.branch=T1`.

## AC2 tx hashes (≥2)

See `TXS.md`. Supply + borrow:

- supply `0x5d5c35890a1c6e631bd543a2c24967628741c559671a6d159b675cabacb621e6`
- borrow `0xa3fd3b92d5821c1658f0f04dbaec4088380c227bf8eb4a2c9b55f2abffe99c55`

Both receipts `status=0x1` on Base Sepolia.

## AC3 position both > 0

`cast call` Morpho `position(bytes32,address)` for guardian `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758`:

- supplyShares = `50000000000000` > 0
- borrowShares = `31000000000000` > 0
- collateral = `19000000000000000` (0.019 WETH assets) > 0

Evidence: `ac3-position.txt`.

## AC4 ratio 60–80% of LLTV

`ac4-ratio.txt`: at seed oracle price, **70.526%** of 91.5% LLTV. Live feed move still **70.692%**. Band SAT.

KeeperHub daily native cap is 0.02 ETH; wrap used 0.019 ETH (`GET /api/analytics/spend-cap`).

**Verdict: PASS.**
