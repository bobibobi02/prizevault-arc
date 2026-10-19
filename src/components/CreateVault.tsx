import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { decodeEventLog } from 'viem'
import { Plus } from 'lucide-react'
import { NETWORKS, PRIZE_VAULT_ABI, NetworkKey } from '@/prizevault-config'
import { TxLink } from './TxLink'

interface CreateVaultProps {
  network: NetworkKey
  onCreated: (vaultId: bigint) => void
}

// Computed at module load — stable for the lifetime of the page, acceptable for date pickers
const PAGE_LOAD_TS = Date.now()
const MIN_DATE = new Date(PAGE_LOAD_TS + 3600_000).toISOString().slice(0, 16)
const MAX_DATE = new Date(PAGE_LOAD_TS + 365 * 86400_000).toISOString().slice(0, 16)

export function CreateVault({ network, onCreated }: CreateVaultProps) {
  const { isConnected, chainId } = useAccount()
  const cfg = NETWORKS[network]
  const isWrongChain = isConnected && chainId !== cfg.chainId

  const [title, setTitle] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')

  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const canSubmit = isConnected && !isWrongChain && title.trim().length > 0 && deadlineDate !== ''

  function handleCreate() {
    if (!canSubmit) return
    const deadline = BigInt(Math.floor(new Date(deadlineDate).getTime() / 1000))
    writeContract({
      address: cfg.contractAddress as `0x${string}`,
      abi: PRIZE_VAULT_ABI,
      functionName: 'createVault',
      args: [title.trim(), deadline],
      chainId: cfg.chainId,
    })
  }

  // Extract vault ID from receipt logs and forward to parent once on success
  if (isSuccess && receipt) {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: PRIZE_VAULT_ABI, data: log.data, topics: log.topics })
        if (decoded.eventName === 'VaultCreated') {
          const args = decoded.args as unknown as { vaultId: bigint }
          onCreated(args.vaultId)
        }
      } catch { /* non-matching log */ }
    }
  }

  const errorMessage = writeError
    ? writeError.message.includes('user rejected')
      ? null
      : writeError.message.split('\n')[0].slice(0, 120)
    : null

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
      <h2 className="display font-semibold text-base" style={{ color: 'var(--ink)' }}>Create a vault</h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Title</label>
          <input
            type="text"
            placeholder="e.g. Hackathon Prize Pool 2026"
            value={title}
            onChange={e => { setTitle(e.target.value); reset() }}
            maxLength={80}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Award deadline</label>
          <input
            type="datetime-local"
            min={MIN_DATE}
            max={MAX_DATE}
            value={deadlineDate}
            onChange={e => { setDeadlineDate(e.target.value); reset() }}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={!canSubmit || isPending || isConfirming}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
        style={{
          background: canSubmit && !isPending && !isConfirming ? 'var(--accent)' : 'var(--surface-muted)',
          color: canSubmit && !isPending && !isConfirming ? '#fff' : 'var(--subtle)',
          cursor: canSubmit && !isPending && !isConfirming ? 'pointer' : 'not-allowed',
        }}
      >
        <Plus size={15} />
        {isPending ? 'Confirm in wallet…' : isConfirming ? 'Creating vault…' : 'Create vault'}
      </button>

      {isWrongChain && (
        <p className="text-xs text-center" style={{ color: '#92400e' }}>Switch to {cfg.label} to create a vault</p>
      )}
      {!isConnected && (
        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Connect your wallet to create a vault</p>
      )}

      {errorMessage && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#fef2f2', color: 'var(--danger)' }}>{errorMessage}</p>
      )}

      {isSuccess && hash && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>Vault created!</span>
          <TxLink hash={hash} network={network} />
        </div>
      )}
    </div>
  )
}
