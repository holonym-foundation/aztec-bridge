import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { fetchPassportPoints } from '@/lib/attestation'

/**
 * GET /api/points?address=<l1>
 *
 * Public HUMN Points lookup for an EVM address. Proxies Human Passport
 * points_data (Season 1 HUMN Points) so the Passport API key stays
 * server-side. Requires no JWT and has no side effects — it exposes only
 * the already-public points for the supplied address. Season-2 Covenant
 * points live in the human-covenant service and are NOT included here.
 *
 * TODO(rate-limit): unauthenticated upstream proxy — same caveat as
 * l1-eligibility. Add IP-based rate limiting before exposing broadly.
 */
export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'A valid EVM `address` query param is required' }, { status: 400 })
    }

    const points = await fetchPassportPoints(address)
    return NextResponse.json({ address, ...points })
  } catch (error) {
    console.error('[points] lookup failed:', error)
    return NextResponse.json({ error: 'Failed to fetch HUMN points' }, { status: 502 })
  }
}
