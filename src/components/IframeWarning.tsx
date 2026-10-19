/**
 * IframeWarning — shown only when the app is running inside a cross-origin
 * iframe (e.g. the Arc Studio preview panel). Browser extensions like MetaMask
 * cannot inject window.ethereum into a cross-origin iframe, so wallet
 * connections will fail there. The fix is to open the app directly in a tab.
 */

import { useState } from 'react'

function isInCrossOriginIframe(): boolean {
  try {
    // If we can access window.top.location without throwing, we're either the
    // top frame or a same-origin iframe — neither blocks extensions.
    return window.self !== window.top
  } catch {
    // Accessing window.top.location threw a SecurityError — definitely a
    // cross-origin iframe.
    return true
  }
}

// Computed once at module evaluation time — always safe during React render.
const IN_IFRAME = isInCrossOriginIframe()
const APP_URL = window.location.href

export function IframeWarning() {
  const [dismissed, setDismissed] = useState(false)

  if (!IN_IFRAME || dismissed) return null

  return (
    <div
      className="w-full px-4 py-3 flex items-center gap-3 text-sm flex-wrap"
      style={{ background: '#fef9c3', borderBottom: '1px solid #fde047', color: '#713f12' }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
        <path d="M8 1.5L1 14.5h14L8 1.5z" stroke="#ca8a04" strokeWidth="1.5" strokeLinejoin="round" fill="#fef08a" />
        <path d="M8 6v4" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="12" r="0.75" fill="#ca8a04" />
      </svg>
      <span className="flex-1">
        <strong>Browser wallet unavailable in this preview.</strong>{' '}
        MetaMask and other extensions only work in a real browser tab, not inside an embedded preview frame.
      </span>
      <a
        href={APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-75 transition-opacity"
        style={{ color: '#92400e' }}
      >
        Open in new tab →
      </a>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity text-lg leading-none"
        style={{ color: '#713f12' }}
      >
        ×
      </button>
    </div>
  )
}
