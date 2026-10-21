# PrizeVault

> **Unaudited. Experimental. Use small amounts only.**

A transparent USDC prize-pool escrow on Arc. The organizer creates a vault, deposits USDC, awards winners, and winners claim directly from the contract. After the deadline the organizer can refund any unawarded USDC. No fees, no admin keys. Claim works as soon as an award exists, even before the deadline.

---

## Live app

**https://lustrous-mochi-95e3a4.netlify.app/**

Use the Mainnet toggle in the app header. If you have several wallet extensions installed, disable all but your own wallet — multiple extensions can conflict with each other.

Built in [Arc Studio](https://studio.arc.io/app/42d70458-62c1-4832-ad86-4ceb65495674). The contract and app were written and tested on Arc Testnet in Studio. The mainnet contract was deployed by the author from their own wallet using Remix, with the same source and compiler settings, and verified on the explorer; Studio then set the mainnet address in the app config.

---

## Deployed contracts

| Network | Address | Explorer |
|---|---|---|
| Arc Mainnet (5042) | `0xFFFB41D6e33Aff10955fdbfAF80358693B996853` | [explorer.arc.io](https://explorer.arc.io/address/0xFFFB41D6e33Aff10955fdbfAF80358693B996853) |
| Arc Testnet (5042002) | `0x1cd598c93c8ee3efa19e4814ade3636c5dc1f8e6` | [explorer.testnet.arc.io](https://explorer.testnet.arc.io/address/0x1cd598c93c8ee3efa19e4814ade3636c5dc1f8e6) |

The mainnet contract is verified on the explorer: solc 0.8.28, optimizer 200 runs, EVM paris. It is the same code as the tested testnet contract.

---

## Example mainnet transactions

All links are to [explorer.arc.io/tx/](https://explorer.arc.io):

| Action | Transaction |
|---|---|
| createVault | [0x3f72804f…](https://explorer.arc.io/tx/0x3f72804f1402e026c63b27e9a45a531b1ef6123810d88a562d99aa30f5e23d09) |
| deposit | [0x434c76f5…](https://explorer.arc.io/tx/0x434c76f51f56c7daa209f8dd2050654a94c0f7c611fb2a59ece16ea9ee6f26fc) |
| award | [0x9c5928c4…](https://explorer.arc.io/tx/0x9c5928c43e0b4afd169070eeee7559fd1050485946b9f8b0995a871fc70d0118) |
| claim | [0x8438871e…](https://explorer.arc.io/tx/0x8438871e27bfa9c1c2db3a78f7bd0c8fb0b9842711ba00b510d6232943b590e3) |

---

## Warning

This contract is **unaudited and experimental**. Use small amounts only. There is no admin key and no upgrade path — bugs cannot be patched after deployment.

---

## Running locally

**Prerequisites:** [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
# Install dependencies
bun install

# Start the dev server (app runs on http://localhost:5173)
bun run dev

# Compile contracts
forge build

# Run contract tests
forge test -vvv
```

The app connects to Arc Testnet by default. Switch the toggle in the header to use Arc Mainnet.

All network and contract configuration lives in `src/prizevault-config.ts`.
