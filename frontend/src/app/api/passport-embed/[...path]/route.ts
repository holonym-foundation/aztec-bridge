import { NextRequest, NextResponse } from 'next/server'
import { PASSPORT_API_KEY } from '@/config/env.config'

// Server-side proxy for the embedded Human Passport widget.
//
// The widget is pointed at this route via `overrideEmbedServiceUrl`, so every
// embed call (`/embed/score/...`, `/embed/stamps/metadata`, `/embed/auto-verify`,
// `/embed/challenge`) arrives here and is forwarded to embed.passport.xyz with the
// real read key injected as `X-API-KEY`. The key therefore never reaches the
// browser bundle — the client only ever holds a non-secret placeholder.
const UPSTREAM_BASE = 'https://embed.passport.xyz'

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (!PASSPORT_API_KEY) {
    return NextResponse.json({ error: 'Passport embed is not configured.' }, { status: 502 })
  }

  const suffix = (path ?? []).map((p) => encodeURIComponent(p)).join('/')
  const upstreamUrl = `${UPSTREAM_BASE}/${suffix}${request.nextUrl.search}`

  // Only forward the headers the upstream needs; drop hop-by-hop and identifying
  // headers (host, cookies, the client's placeholder key) and set the real key.
  const headers: Record<string, string> = { 'X-API-KEY': PASSPORT_API_KEY }
  const contentType = request.headers.get('content-type')
  if (contentType) headers['content-type'] = contentType
  const accept = request.headers.get('accept')
  if (accept) headers['accept'] = accept

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      // @ts-expect-error - duplex is required by undici when sending a body but is
      // not yet in the DOM RequestInit types.
      duplex: hasBody ? 'half' : undefined,
    })

    const body = await upstream.arrayBuffer()
    const resHeaders = new Headers()
    const upstreamContentType = upstream.headers.get('content-type')
    if (upstreamContentType) resHeaders.set('content-type', upstreamContentType)
    return new NextResponse(body, { status: upstream.status, headers: resHeaders })
  } catch {
    // Never surface upstream internals or the key.
    return NextResponse.json({ error: 'Passport embed request failed.' }, { status: 502 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return forward(request, path)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return forward(request, path)
}
