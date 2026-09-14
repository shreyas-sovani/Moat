# Gate 0.5 funding snapshot (this block) — market NOT created

Paused before T1 market create / wrap / seed (new onchain block; operator sending more tokens).

Live guardian balances 2026-09-14T16:50Z Base Sepolia:

- ETH 0.08
- USDC 50
- WETH 0
- morpho.markets still `[]`
- branch still **T1-pending**

Do **not** guess a market id. Next agent: wrap some ETH→WETH via KeeperHub (`simulate: true` first), create permissionless WETH/USDC market, seed supply+borrow. Ask operator if 50 USDC / 0.08 ETH is enough or wait for more faucets.
