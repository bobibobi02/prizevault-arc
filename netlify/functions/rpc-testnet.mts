/**
 * Netlify Function: rpc-testnet
 *
 * Server-side JSON-RPC proxy for Arc Testnet (chain 5042002).
 * Forwards POST bodies to the Arc Testnet RPC and returns the response.
 * Bypasses Cloudflare bot-detection that blocks browser fetch() from
 * non-arc.io origins.
 *
 * Reachable in the app as POST /api/rpc-testnet
 */

const UPSTREAM = 'https://rpc.testnet.arc.io'

export default async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() })
  }

  let body: string
  try {
    body = await request.text()
  } catch {
    return new Response('Bad request', { status: 400, headers: corsHeaders() })
  }

  let upstream: Response
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Upstream unreachable' }, id: null }),
      { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
    )
  }

  const data = await upstream.text()
  return new Response(data, {
    status: upstream.status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export const config = { path: '/api/rpc-testnet' }
