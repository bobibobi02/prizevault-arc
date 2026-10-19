import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Search } from 'lucide-react'
import { NetworkKey } from '@/prizevault-config'

interface LookupVaultProps {
  network: NetworkKey
  onGo: (vaultId: bigint) => void
}

export function LookupVault({ onGo }: LookupVaultProps) {
  const [id, setId] = useState('')
  const { isConnected } = useAccount()

  function handleGo() {
    const n = BigInt(id.trim())
    if (n >= 0n) onGo(n)
  }

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
      <h2 className="display font-semibold text-base" style={{ color: 'var(--ink)' }}>View a vault</h2>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="1"
          value={id}
          onChange={e => setId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && id !== '' && handleGo()}
          placeholder="Vault ID, e.g. 0"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm tabular-nums outline-none"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        />
        <button
          onClick={handleGo}
          disabled={id === ''}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
          style={{
            background: id !== '' ? 'var(--accent)' : 'var(--surface-muted)',
            color: id !== '' ? '#fff' : 'var(--subtle)',
            cursor: id !== '' ? 'pointer' : 'not-allowed',
          }}
        >
          <Search size={14} />
          View
        </button>
      </div>
      {!isConnected && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Connect your wallet above — reads are routed through your wallet provider.
        </p>
      )}
    </div>
  )
}
