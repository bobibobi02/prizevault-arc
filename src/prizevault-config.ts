/**
 * PrizeVault — single source of truth for network and contract config.
 *
 * To point at mainnet later:
 *   1. Set ACTIVE_NETWORK to 'mainnet'
 *   2. Add the mainnet contract address in NETWORKS.mainnet.contractAddress
 *
 * The network selector in the UI reads from ACTIVE_NETWORK and lets the
 * user toggle between testnet and mainnet at runtime.
 */

import prizeVaultArtifact from '../contracts/out/PrizeVault.sol/PrizeVault.json'
import { requireChain, getUsdc, buildTxExplorerUrl } from '@/onchain-facts'

export type NetworkKey = 'testnet' | 'mainnet'

const ARC_TESTNET_CHAIN_ID = 5042002
const ARC_MAINNET_CHAIN_ID = 5042

export const NETWORKS: Record<NetworkKey, {
  chainId: number
  label: string
  explorerBase: string
  rpcUrl: string
  contractAddress: string
  usdcAddress: string
}> = {
  testnet: {
    chainId: ARC_TESTNET_CHAIN_ID,
    label: 'Arc Testnet',
    explorerBase: requireChain(ARC_TESTNET_CHAIN_ID).explorerBase,
    rpcUrl: requireChain(ARC_TESTNET_CHAIN_ID).rpcUrls[0],
    contractAddress: '0x1cd598c93c8ee3efa19e4814ade3636c5dc1f8e6',
    usdcAddress: getUsdc(ARC_TESTNET_CHAIN_ID)!.address,
  },
  mainnet: {
    chainId: ARC_MAINNET_CHAIN_ID,
    label: 'Arc Mainnet',
    explorerBase: requireChain(ARC_MAINNET_CHAIN_ID).explorerBase,
    rpcUrl: requireChain(ARC_MAINNET_CHAIN_ID).rpcUrls[0],
    contractAddress: '0xFFFB41D6e33Aff10955fdbfAF80358693B996853',
    usdcAddress: getUsdc(ARC_MAINNET_CHAIN_ID)!.address,
  },
}

/** The default active network. Change to 'mainnet' for production. */
export const DEFAULT_NETWORK: NetworkKey = 'testnet'

export const PRIZE_VAULT_ABI = prizeVaultArtifact.abi

export function getTxExplorerUrl(networkKey: NetworkKey, txHash: string): string {
  const chainId = NETWORKS[networkKey].chainId
  return buildTxExplorerUrl(chainId, txHash)
}

export function getAddressExplorerUrl(networkKey: NetworkKey, address: string): string {
  return `${NETWORKS[networkKey].explorerBase}/address/${address}`
}
