import { useState } from 'react'
import { NetworkKey, DEFAULT_NETWORK, NETWORKS } from '@/prizevault-config'
import { Header } from '@/components/Header'
import { HowItWorks } from '@/components/HowItWorks'
import { CreateVault } from '@/components/CreateVault'
import { LookupVault } from '@/components/LookupVault'
import { VaultPage } from '@/components/VaultPage'
import { IframeWarning } from '@/components/IframeWarning'

export default function App() {
  const [network, setNetwork] = useState<NetworkKey>(DEFAULT_NETWORK)
  const [vaultId, setVaultId] = useState<bigint | null>(null)

  function handleCreated(id: bigint) {
    setVaultId(id)
  }

  function handleNetworkChange(n: NetworkKey) {
    setNetwork(n)
    setVaultId(null) // reset view on network switch — IDs are per-network
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <IframeWarning />
      <Header network={network} onNetworkChange={handleNetworkChange} />

      {/* Mainnet warning banner */}
      {network === 'mainnet' && !NETWORKS.mainnet.contractAddress && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
            Mainnet contract not yet deployed. Set <code className="mono text-xs">contractAddress</code> in <code className="mono text-xs">src/prizevault-config.ts</code> after deploying.
          </div>
        </div>
      )}

      {vaultId !== null ? (
        <VaultPage network={network} vaultId={vaultId} onBack={() => setVaultId(null)} />
      ) : (
        <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
          {/* Hero */}
          <div className="text-center space-y-2 pb-2">
            <h1 className="display font-bold text-3xl" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              PrizeVault
            </h1>
            <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--muted)' }}>
              Transparent USDC prize-pool escrow for contests and hackathons.
              No fees, no admin keys, no surprises.
            </p>
          </div>

          <CreateVault network={network} onCreated={handleCreated} />
          <LookupVault network={network} onGo={setVaultId} />
          <HowItWorks />

          {/* Contract info */}
          <div className="rounded-2xl px-5 py-4 text-xs space-y-1" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--ink-2)' }}>Contract ({NETWORKS[network].label})</p>
            <a
              href={`${NETWORKS[network].explorerBase}/address/${NETWORKS[network].contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono break-all hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {NETWORKS[network].contractAddress || 'Not deployed on this network yet'}
            </a>
          </div>
        </main>
      )}
    </div>
  )
}
