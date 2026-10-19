import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { NetworkKey, NETWORKS } from '@/prizevault-config'

interface HeaderProps {
  network: NetworkKey
  onNetworkChange: (n: NetworkKey) => void
}

export function Header({ network, onNetworkChange }: HeaderProps) {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const targetChainId = NETWORKS[network].chainId
  const isWrongChain = isConnected && chainId !== targetChainId

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-auto">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="2" stroke="white" strokeWidth="1.5" />
              <path d="M5 7h4M7 5v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="display font-semibold text-base" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>PrizeVault</span>
        </div>

        {/* Network toggle */}
        <div className="flex items-center gap-1 rounded-full p-1 text-xs font-medium" style={{ background: 'var(--surface-muted)' }}>
          {(['testnet', 'mainnet'] as NetworkKey[]).map((n) => (
            <button
              key={n}
              onClick={() => onNetworkChange(n)}
              className="rounded-full px-3 py-1 transition-all"
              style={{
                background: network === n ? 'var(--accent)' : 'transparent',
                color: network === n ? '#fff' : 'var(--muted)',
              }}
            >
              {n === 'testnet' ? 'Testnet' : 'Mainnet'}
            </button>
          ))}
        </div>

        {/* Wrong-chain banner */}
        {isWrongChain && (
          <button
            onClick={() => switchChain({ chainId: targetChainId })}
            disabled={isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            style={{ background: '#fef3c7', color: '#92400e' }}
          >
            {isPending ? 'Switching…' : `Switch to ${NETWORKS[network].label}`}
          </button>
        )}

        <ConnectKitButton />
      </div>
    </header>
  )
}
