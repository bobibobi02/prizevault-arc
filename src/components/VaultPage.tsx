import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { ArrowLeft, Clock, ExternalLink, AlertTriangle } from 'lucide-react'
import { NETWORKS, PRIZE_VAULT_ABI, NetworkKey, getAddressExplorerUrl } from '@/prizevault-config'
import { parseAmount, Amount, usdcDecimalsFor } from '@/onchain-money'
import { TxLink } from './TxLink'

interface VaultPageProps {
  network: NetworkKey
  vaultId: bigint
  onBack: () => void
}

type VaultData = {
  organizer: string
  title: string
  awardDeadline: bigint
  deposited: bigint
  awarded: bigint
  refunded: boolean
}

// Read timeout: if the query hasn't resolved after this many ms, show an error.
const READ_TIMEOUT_MS = 10_000

// Custom hook: live countdown string, updated by an interval effect
function useCountdown(deadline: bigint): string {
  const deadlineNum = Number(deadline)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const update = () => setRemaining(deadlineNum - Math.floor(Date.now() / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [deadlineNum])

  if (remaining <= 0) return 'Deadline passed'
  const d = Math.floor(remaining / 86400)
  const h = Math.floor((remaining % 86400) / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function fmtUsdc(raw: bigint, chainId: number): string {
  return Amount.fromRaw(raw, usdcDecimalsFor(chainId)).toFixed(2)
}

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ─── Deposit Panel ────────────────────────────────────────────────────────────

interface DepositPanelProps { vaultId: bigint; network: NetworkKey; vaultData: VaultData; awardDeadlinePassed: boolean; onSuccess: () => void }

function DepositPanel({ vaultId, network, vaultData, awardDeadlinePassed, onSuccess }: DepositPanelProps) {
  const cfg = NETWORKS[network]
  const { address, chainId } = useAccount()
  const [amount, setAmount] = useState('')

  const { writeContract: approve, data: approveHash, isPending: approvePending, error: approveError } = useWriteContract()
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContract: deposit, data: depositHash, isPending: depositPending, error: depositError } = useWriteContract()
  const { isLoading: depositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash })

  useEffect(() => {
    if (depositSuccess) { onSuccess() }
  }, [depositSuccess, onSuccess])

  const isWrongChain = chainId !== cfg.chainId
  const isOrganizer = !!address && address.toLowerCase() === vaultData.organizer.toLowerCase()
  const parsed = amount ? (() => { try { return parseAmount(cfg.chainId, amount) } catch { return null } })() : null
  const canSubmit = parsed !== null && !isWrongChain && isOrganizer && !awardDeadlinePassed

  const handleApprove = useCallback(() => {
    if (!parsed) return
    approve({ address: cfg.usdcAddress as `0x${string}`, abi: erc20Abi, functionName: 'approve', args: [cfg.contractAddress as `0x${string}`, parsed.raw], chainId: cfg.chainId })
  }, [approve, cfg, parsed])

  const handleDeposit = useCallback(() => {
    if (!parsed) return
    deposit({ address: cfg.contractAddress as `0x${string}`, abi: PRIZE_VAULT_ABI, functionName: 'deposit', args: [vaultId, parsed.raw], chainId: cfg.chainId })
  }, [deposit, cfg, vaultId, parsed])

  const errMsg = (approveError || depositError)
    ? (approveError || depositError)!.message.includes('user rejected') ? null : (approveError || depositError)!.message.split('\n')[0].slice(0, 120)
    : null

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Amount (USDC)</label>
        <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="0.00" className="w-full rounded-xl px-4 py-2.5 text-sm tabular-nums outline-none"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
      </div>

      {!approveSuccess ? (
        <button onClick={handleApprove} disabled={!canSubmit || approvePending}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: canSubmit && !approvePending ? 'var(--accent)' : 'var(--surface-muted)', color: canSubmit && !approvePending ? '#fff' : 'var(--subtle)', cursor: canSubmit && !approvePending ? 'pointer' : 'not-allowed' }}>
          {approvePending ? 'Confirm approve…' : 'Step 1: Approve USDC'}
        </button>
      ) : (
        <button onClick={handleDeposit} disabled={depositPending || depositConfirming}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: depositPending || depositConfirming ? 'var(--surface-muted)' : 'var(--accent)', color: depositPending || depositConfirming ? 'var(--subtle)' : '#fff', cursor: depositPending || depositConfirming ? 'not-allowed' : 'pointer' }}>
          {depositPending ? 'Confirm deposit…' : depositConfirming ? 'Depositing…' : 'Step 2: Deposit USDC'}
        </button>
      )}

      {errMsg && <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#fef2f2', color: 'var(--danger)' }}>{errMsg}</p>}
      {approveHash && approveSuccess && <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}><span>Approved</span><TxLink hash={approveHash} network={network} /></div>}
      {depositHash && depositSuccess && <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--success)' }}><span>Deposited!</span><TxLink hash={depositHash} network={network} /></div>}
    </div>
  )
}

// ─── Award Panel ──────────────────────────────────────────────────────────────

interface AwardPanelProps { vaultId: bigint; network: NetworkKey; vaultData: VaultData; awardDeadlinePassed: boolean; onSuccess: () => void }

function AwardPanel({ vaultId, network, vaultData, awardDeadlinePassed, onSuccess }: AwardPanelProps) {
  const cfg = NETWORKS[network]
  const { address, chainId } = useAccount()
  const [winner, setWinner] = useState('')
  const [amount, setAmount] = useState('')

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) { onSuccess() }
  }, [isSuccess, onSuccess])

  const isOrganizer = !!address && address.toLowerCase() === vaultData.organizer.toLowerCase()
  const isWrongChain = chainId !== cfg.chainId
  const parsed = amount ? (() => { try { return parseAmount(cfg.chainId, amount) } catch { return null } })() : null
  const remaining = vaultData.deposited - vaultData.awarded
  const canSubmit = isOrganizer && !isWrongChain && !awardDeadlinePassed && winner.startsWith('0x') && winner.length === 42 && parsed !== null && parsed.raw <= remaining

  const handleAward = useCallback(() => {
    if (!parsed) return
    writeContract({ address: cfg.contractAddress as `0x${string}`, abi: PRIZE_VAULT_ABI, functionName: 'award', args: [vaultId, winner as `0x${string}`, parsed.raw], chainId: cfg.chainId })
  }, [writeContract, cfg, vaultId, winner, parsed])

  const errMsg = writeError ? (writeError.message.includes('user rejected') ? null : writeError.message.split('\n')[0].slice(0, 120)) : null

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Winner address</label>
        <input type="text" value={winner} onChange={e => setWinner(e.target.value)} placeholder="0x..."
          className="w-full rounded-xl px-4 py-2.5 text-sm mono outline-none"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Amount (USDC) — {fmtUsdc(remaining, cfg.chainId)} available</label>
        <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
          className="w-full rounded-xl px-4 py-2.5 text-sm tabular-nums outline-none"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
      </div>
      <button onClick={handleAward} disabled={!canSubmit || isPending}
        className="w-full py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: canSubmit && !isPending ? 'var(--accent)' : 'var(--surface-muted)', color: canSubmit && !isPending ? '#fff' : 'var(--subtle)', cursor: canSubmit && !isPending ? 'pointer' : 'not-allowed' }}>
        {isPending ? 'Confirm in wallet…' : 'Award'}
      </button>
      {errMsg && <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#fef2f2', color: 'var(--danger)' }}>{errMsg}</p>}
      {hash && isSuccess && <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--success)' }}><span>Awarded!</span><TxLink hash={hash} network={network} /></div>}
    </div>
  )
}

// ─── Vault Page ───────────────────────────────────────────────────────────────

export function VaultPage({ network, vaultId, onBack }: VaultPageProps) {
  const cfg = NETWORKS[network]
  const { address, chainId: walletChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [refreshKey, setRefreshKey] = useState(0)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showAward, setShowAward] = useState(false)
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const walletConnected = !!address
  // Reads go through the wallet provider (custom transport). They only work
  // correctly when the wallet is on the same chain as the selected network.
  const onCorrectChain = walletConnected && walletChainId === cfg.chainId
  const readsEnabled = onCorrectChain

  const { data: vaultRaw, isPending: vaultPending, isError: vaultError, isFetching } = useReadContract({
    address: cfg.contractAddress as `0x${string}`,
    abi: PRIZE_VAULT_ABI,
    functionName: 'getVault',
    args: [vaultId],
    chainId: cfg.chainId,
    query: { enabled: readsEnabled, refetchInterval: 8000, gcTime: 0, retry: 1 },
  }) as { data: readonly [string, string, bigint, bigint, bigint, boolean] | undefined; isPending: boolean; isError: boolean; isFetching: boolean }

  const { data: myClaimable, isLoading: claimLoading } = useReadContract({
    address: cfg.contractAddress as `0x${string}`,
    abi: PRIZE_VAULT_ABI,
    functionName: 'claimable',
    args: [vaultId, address ?? '0x0000000000000000000000000000000000000000'],
    chainId: cfg.chainId,
    query: { enabled: readsEnabled, refetchInterval: 8000, gcTime: 0 },
  }) as { data: bigint | undefined; isLoading: boolean }

  // Timeout: start a timer when a fetch is in-flight; cancel it when the
  // query resolves or is disabled. Only setTimedOut(true) from the async
  // callback — never synchronously inside the effect body (lint rule).
  useEffect(() => {
    // Cancel any existing timer whenever deps change.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    // Only arm the timer while we're actively fetching with no result yet.
    if (readsEnabled && isFetching && !vaultRaw && !vaultError) {
      timeoutRef.current = setTimeout(() => setTimedOut(true), READ_TIMEOUT_MS)
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [readsEnabled, isFetching, vaultRaw, vaultError])

  // Maintain deadlinePassed via an interval effect so it stays fresh
  useEffect(() => {
    if (!vaultRaw) return
    const deadline = Number(vaultRaw[2])
    const check = () => setDeadlinePassed(Math.floor(Date.now() / 1000) >= deadline)
    check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [vaultRaw])

  const { writeContract: claim, data: claimHash, isPending: claimPending, error: claimError, reset: resetClaim } = useWriteContract()
  const { isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  const { writeContract: refund, data: refundHash, isPending: refundPending, error: refundError, reset: resetRefund } = useWriteContract()
  const { isSuccess: refundSuccess } = useWaitForTransactionReceipt({ hash: refundHash })

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), [])
  const extraKey = (claimSuccess ? 'c' : '') + (refundSuccess ? 'r' : '')
  const countdown = useCountdown(vaultRaw ? vaultRaw[2] : 0n)

  // ── Gate 1: no wallet ──────────────────────────────────────────────────────
  if (!walletConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
        <p className="text-base font-medium" style={{ color: 'var(--ink)' }}>Connect your wallet to view vault #{vaultId.toString()}</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Reads go through your wallet provider to bypass RPC CORS restrictions.</p>
        <button onClick={onBack} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Go back</button>
      </div>
    )
  }

  // ── Gate 2: wrong chain ────────────────────────────────────────────────────
  if (!onCorrectChain) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
        <p className="text-base font-medium" style={{ color: 'var(--ink)' }}>Wrong network</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your wallet is on a different network. Switch to {cfg.label} to read this vault.
        </p>
        <button
          onClick={() => switchChain({ chainId: cfg.chainId })}
          disabled={isSwitching}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff', cursor: isSwitching ? 'not-allowed' : 'pointer', opacity: isSwitching ? 0.7 : 1 }}
        >
          {isSwitching ? 'Switching…' : `Switch to ${cfg.label}`}
        </button>
        <div><button onClick={onBack} className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Go back</button></div>
      </div>
    )
  }

  // ── Gate 3: timed out ─────────────────────────────────────────────────────
  // Only show timeout screen when on the correct chain — chain-switch clears it visually.
  if (timedOut && onCorrectChain) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
        <p className="text-base font-medium" style={{ color: 'var(--ink)' }}>Could not load vault</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          The RPC request timed out after {READ_TIMEOUT_MS / 1000}s.
          Make sure your wallet is on {cfg.label} and try again.
        </p>
        <button
          onClick={() => { setTimedOut(false); setRefreshKey(k => k + 1) }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Retry
        </button>
        <div><button onClick={onBack} className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Go back</button></div>
      </div>
    )
  }

  // ── Gate 4: loading ────────────────────────────────────────────────────────
  if (vaultPending && !vaultError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)' }} />
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Loading via {cfg.label}…</p>
      </div>
    )
  }

  // ── Gate 5: not found / error ──────────────────────────────────────────────
  if (vaultError || !vaultRaw || vaultRaw[0] === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
        <p style={{ color: 'var(--muted)' }}>Vault #{vaultId.toString()} not found on {cfg.label}.</p>
        <button onClick={onBack} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Go back</button>
      </div>
    )
  }

  const vault: VaultData = { organizer: vaultRaw[0], title: vaultRaw[1], awardDeadline: vaultRaw[2], deposited: vaultRaw[3], awarded: vaultRaw[4], refunded: vaultRaw[5] }
  const isOrganizer = !!address && address.toLowerCase() === vault.organizer.toLowerCase()
  const canRefund = isOrganizer && deadlinePassed && !vault.refunded && vault.deposited > vault.awarded
  const hasClaim = (myClaimable ?? 0n) > 0n

  function handleClaim() {
    resetClaim()
    claim({ address: cfg.contractAddress as `0x${string}`, abi: PRIZE_VAULT_ABI, functionName: 'claim', args: [vaultId], chainId: cfg.chainId })
  }

  function handleRefund() {
    resetRefund()
    refund({ address: cfg.contractAddress as `0x${string}`, abi: PRIZE_VAULT_ABI, functionName: 'refund', args: [vaultId], chainId: cfg.chainId })
  }

  const claimErrMsg = claimError ? (claimError.message.includes('user rejected') ? null : claimError.message.split('\n')[0].slice(0, 120)) : null
  const refundErrMsg = refundError ? (refundError.message.includes('user rejected') ? null : refundError.message.split('\n')[0].slice(0, 120)) : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Hero card */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-medium mb-1 tabular-nums" style={{ color: 'var(--subtle)' }}>Vault #{vaultId.toString()}</p>
            <h1 className="display font-bold text-xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>{vault.title}</h1>
          </div>
          <a href={getAddressExplorerUrl(network, cfg.contractAddress)} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 p-2 rounded-lg" style={{ background: 'var(--surface-muted)' }}>
            <ExternalLink size={14} style={{ color: 'var(--muted)' }} />
          </a>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Deposited', value: `$${fmtUsdc(vault.deposited, cfg.chainId)}` },
            { label: 'Awarded', value: `$${fmtUsdc(vault.awarded, cfg.chainId)}` },
            { label: 'Unawarded', value: `$${fmtUsdc(vault.deposited - vault.awarded, cfg.chainId)}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-muted)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
              <p className="display font-semibold text-base tabular-nums" style={{ color: 'var(--ink)' }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
          <span>
            Organizer:{' '}
            <a href={getAddressExplorerUrl(network, vault.organizer)} target="_blank" rel="noopener noreferrer"
              className="mono font-medium" style={{ color: 'var(--accent)' }}>
              {shortenAddr(vault.organizer)}
            </a>
          </span>
          <span className="flex items-center gap-1"><Clock size={12} />{countdown}</span>
          {vault.refunded && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#dcfce7', color: '#166534' }}>Refunded</span>}
        </div>
      </div>

      {/* My claim */}
      {address && !claimLoading && hasClaim && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#166534' }}>You have a prize to claim!</p>
              <p className="text-xs mt-0.5 tabular-nums" style={{ color: '#16a34a' }}>${fmtUsdc(myClaimable!, cfg.chainId)} USDC</p>
            </div>
            <button onClick={handleClaim} disabled={claimPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: '#16a34a', color: '#fff', cursor: claimPending ? 'not-allowed' : 'pointer' }}>
              {claimPending ? 'Confirming…' : 'Claim'}
            </button>
          </div>
          {claimHash && claimSuccess && <div className="flex items-center gap-2 text-xs" style={{ color: '#166534' }}><span>Claimed!</span><TxLink hash={claimHash} network={network} /></div>}
          {claimErrMsg && <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#fef2f2', color: 'var(--danger)' }}>{claimErrMsg}</p>}
        </div>
      )}

      {/* Organizer actions */}
      {isOrganizer && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
          <p className="display font-semibold text-sm" style={{ color: 'var(--ink)' }}>Organizer actions</p>

          {!deadlinePassed && (
            <div className="space-y-3">
              <button onClick={() => setShowDeposit(!showDeposit)}
                className="w-full flex items-center justify-between text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}>
                Deposit USDC <ChevronIcon open={showDeposit} />
              </button>
              {showDeposit && (
                <DepositPanel key={`deposit-${refreshKey}-${extraKey}`} vaultId={vaultId} network={network} vaultData={vault} awardDeadlinePassed={deadlinePassed} onSuccess={handleRefresh} />
              )}

              <button onClick={() => setShowAward(!showAward)}
                className="w-full flex items-center justify-between text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}>
                Award a winner <ChevronIcon open={showAward} />
              </button>
              {showAward && (
                <AwardPanel key={`award-${refreshKey}-${extraKey}`} vaultId={vaultId} network={network} vaultData={vault} awardDeadlinePassed={deadlinePassed} onSuccess={handleRefresh} />
              )}
            </div>
          )}

          {canRefund && (
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                <span>Deadline passed. You can reclaim ${fmtUsdc(vault.deposited - vault.awarded, cfg.chainId)} USDC (deposited minus awarded).</span>
              </div>
              <button onClick={handleRefund} disabled={refundPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: refundPending ? 'var(--surface-muted)' : 'var(--ink)', color: refundPending ? 'var(--subtle)' : '#fff', cursor: refundPending ? 'not-allowed' : 'pointer' }}>
                {refundPending ? 'Confirming…' : 'Refund unawarded USDC'}
              </button>
              {refundHash && refundSuccess && <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--success)' }}><span>Refunded!</span><TxLink hash={refundHash} network={network} /></div>}
              {refundErrMsg && <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#fef2f2', color: 'var(--danger)' }}>{refundErrMsg}</p>}
            </div>
          )}

          {deadlinePassed && !canRefund && !vault.refunded && vault.deposited <= vault.awarded && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>All deposited funds have been awarded. Nothing to refund.</p>
          )}
        </div>
      )}

      {vault.awarded > 0n && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
          <p className="display font-semibold text-sm mb-2" style={{ color: 'var(--ink)' }}>Awards</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Total awarded: ${fmtUsdc(vault.awarded, cfg.chainId)} USDC.
            Winners can check their claimable amount by entering vault #{vaultId.toString()} in the lookup box.
          </p>
        </div>
      )}
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--muted)' }}>
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
