# Gate 0.6 — faucet + notification (this block)

Evaluated 2026-09-14T16:50Z. Testnet only. No mainnet. No real funds.

## AC1 wallets × assets

Guardian `0x08dfDC3D060085D5F61e18F7c3f7E8f7736B3758` on Base Sepolia (`cast` vs `https://sepolia.base.org`):

| Asset | Raw | Human |
|---|---|---|
| ETH | 80000000000000000 wei | **0.08 ETH** |
| USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 50000000 | **50 USDC** |
| WETH `0x4200000000000000000000000000000000000006` | 0 | **0 WETH** (wrap not started this block) |

Operator stated more ETH/USDC coming (faucet limit). Adversary wallet not created/funded separately (PRD allows same org wallet as drill attacker).

**AC1:** SAT for guardian × three assets (WETH is zero, which is a recorded live fact). Not SAT for a second adversary wallet until one exists.

## AC2 delivered notification

- Bot `getMe` ok; username `moat69bot`
- Direct `sendMessage` ok; `message_id` **4**
- KeeperHub `GET /api/integrations` includes `{ id: m2ovhyo51qj0ixr3pl3dq, type: telegram }`
- `POST /api/integrations/m2ovhyo51qj0ixr3pl3dq/test` → **200** `{ "status": "success", "message": "Connection successful" }`
- Chat id lives only in gitignored `.env` as `TELEGRAM_CHAT_ID`

**AC2 photo:** operator must drop a screenshot of message 4 into this folder (`screenshot.png`) for a camera-complete PASS. API delivery is proven without it.

**Verdict:** functional V-T1 **SAT**. Formal Gate 0.6 **PASS pending screenshot + adversary wallet** (ask operator).
