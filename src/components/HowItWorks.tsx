import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

const STEPS = [
  { n: '1', title: 'Create a vault', body: 'Set a title and award deadline (up to 1 year). The vault gets a public ID anyone can look up.' },
  { n: '2', title: 'Deposit USDC', body: 'The organizer approves then deposits USDC into the vault before the deadline. Only the organizer can deposit.' },
  { n: '3', title: 'Award winners', body: 'Before the deadline, the organizer names each winner and the USDC amount they earn. Awarded amounts can never exceed what was deposited.' },
  { n: '4', title: 'Winners claim', body: 'Each winner calls Claim to pull their USDC. Claims work even after the deadline — winners are never locked out.' },
  { n: '5', title: 'Refund unawarded funds', body: 'After the deadline, the organizer can reclaim any USDC that was deposited but not awarded.' },
]

export function HowItWorks() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="display font-semibold text-sm" style={{ color: 'var(--ink-2)' }}>How it works</span>
        <ChevronDown
          size={16}
          style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-3">
              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {s.n}
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>{s.title}</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{s.body}</p>
              </div>
            </div>
          ))}

          <div className="rounded-xl px-4 py-3 mt-4 text-xs font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
            Unaudited contract. Use small amounts. Verify the contract address before depositing real funds.
          </div>
        </div>
      )}
    </div>
  )
}
