# PrizeVault

> Built with Arc Studio - money-powered apps in minutes

Transparent USDC prize-pool escrow for contests and hackathons on Arc.

---

## Deployed Contracts

| Network | Address | Explorer |
|---|---|---|
| Arc Testnet (5042002) | `0x1cd598c93c8ee3efa19e4814ade3636c5dc1f8e6` | https://explorer.testnet.arc.io/address/0x1cd598c93c8ee3efa19e4814ade3636c5dc1f8e6 |
| Arc Testnet (5042002) — v1 | `0x56d90a116f02bbae7aec00f8a65b41a24c2446b2` | superseded |
| Arc Mainnet (5042) | `0xFFFB41D6e33Aff10955fdbfAF80358693B996853` | https://explorer.arc.io/address/0xFFFB41D6e33Aff10955fdbfAF80358693B996853 |

## Config

- Single config file: `src/prizevault-config.ts`
- Network toggle: testnet/mainnet selector in the UI header
- To add mainnet: set `contractAddress` in `NETWORKS.mainnet` and change `DEFAULT_NETWORK` to `'mainnet'`
- USDC address on Arc (both networks): `0x3600000000000000000000000000000000000000` (6 decimals ERC-20)

## Contract

- Source: `contracts/PrizeVault.sol`
- Tests: `contracts/test/PrizeVault.t.sol` (26 tests, all pass)
- Artifact: `contracts/out/PrizeVault.sol/PrizeVault.json`
- No OZ imports (Paris EVM target — mcopy opcode not available)
- No upgradeability, no admin keys, no fees
- Reentrancy guard: local uint8 `_entered` flag
- Checks USDC bool return values, CEI order for claim and refund
- Custom errors only (no require strings)
- Deadline semantics: `deposit`/`award` close at `block.timestamp >= awardDeadline`; `refund` opens at `block.timestamp >= awardDeadline` (exact boundary: same block closes deposits AND opens refund)

## Key Files

- `src/prizevault-config.ts` — all network/contract config (one place)
- `src/components/Header.tsx` — wallet connect + network toggle + wrong-chain banner
- `src/components/CreateVault.tsx` — create vault form
- `src/components/VaultPage.tsx` — vault detail: deposit, award, claim, refund
- `src/components/LookupVault.tsx` — look up vault by ID
- `src/components/HowItWorks.tsx` — collapsible explainer + unaudited warning
- `src/components/TxLink.tsx` — explorer link for tx hashes
