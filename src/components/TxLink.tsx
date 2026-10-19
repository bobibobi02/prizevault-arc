import { ExternalLink } from 'lucide-react'
import { NetworkKey, getTxExplorerUrl } from '@/prizevault-config'

interface TxLinkProps {
  hash: string
  network: NetworkKey
}

export function TxLink({ hash, network }: TxLinkProps) {
  const url = getTxExplorerUrl(network, hash)
  const short = `${hash.slice(0, 10)}…${hash.slice(-8)}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
      style={{ background: 'var(--surface-muted)', color: 'var(--accent)' }}
    >
      <span className="mono">{short}</span>
      <ExternalLink size={11} />
    </a>
  )
}
