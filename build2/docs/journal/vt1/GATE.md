# Gate 0.6 — faucet + notification

Evaluated 2026-09-14T17:34:53Z. Testnet only. No mainnet. No real funds.

## AC1 wallets × assets

Guardian `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758` on Base Sepolia after T1 seed:

| Asset | Location | Amount |
|---|---|---|
| ETH | wallet | **0.061 ETH** |
| USDC | wallet | **31 USDC** (borrowed) |
| USDC | Morpho supply | **50 USDC** |
| WETH | Morpho collateral | **0.019 WETH** |

Adversary = **same guardian wallet** (operator: use same wallet). PRD allows this for the drill attacker.

**AC1:** SAT.

## AC2 delivered notification

- Bot `getMe` ok; username `moat69bot`
- Direct `sendMessage` ok; `message_id` **4**
- KeeperHub telegram integration `m2ovhyo51qj0ixr3pl3dq` test 200
- Screenshot: `screenshot.png` (and original `PHOTO-2026-09-14-22-52-05.jpg`) showing `@moat69bot` delivered “Moat V-T1: KeeperHub notification path live on Base Sepolia testnet. No mainnet. No real funds.”

**AC2:** SAT.

**Verdict: PASS.**
