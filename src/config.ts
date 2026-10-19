/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, custom, createConfig, fallback } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arc.id, arc.rpcUrls.default.http[0])

/**
 * Build the transport for Arc chains.
 *
 * Arc RPC endpoints use Cloudflare bot-detection that blocks browser fetch()
 * from non-arc.io origins (e.g. netlify.app). To work on any domain we
 * route all JSON-RPC calls through the injected wallet provider
 * (window.ethereum) using viem's `custom()` transport. MetaMask and other
 * extensions proxy the call from their background service worker — no browser
 * CORS restriction applies.
 *
 * Fallback: if no injected provider is present (no wallet connected / no
 * extension installed), fall back to the direct RPC URL. This will work on
 * arc.io domains and in local dev, but fail on netlify.app without a wallet.
 * The VaultPage already shows a "Connect wallet" prompt in that case.
 */
function arcTransport(directRpcUrl: string) {
  const provider = typeof window !== 'undefined'
    ? (window as { ethereum?: Record<string, unknown> }).ethereum
    : undefined

  if (provider) {
    // Route all RPC calls through the injected wallet provider.
    // This sidesteps CORS entirely — the extension makes the call.
    return fallback([
      custom(provider as Parameters<typeof custom>[0]),
      http(directRpcUrl),
    ])
  }

  // SSR or no wallet — direct HTTP (works in local dev and on arc.io).
  return http(directRpcUrl)
}

export const config = createConfig({
  chains: [arcTestnet, arc, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: arcTransport(arcTestnet.rpcUrls.default.http[0]),
    [arc.id]: arcTransport(arc.rpcUrls.default.http[0]),
    [mainnet.id]: http(), // Ethereum RPCs have open CORS — no proxy needed
  },
})
