import { NextResponse, type NextRequest } from 'next/server'
import { getFrameAncestors, getPermissionsPolicy } from '@/lib/embedAllowlist'

// These headers live here rather than in next.config's headers() because the
// frame-ancestors list comes from env (which next.config would bake into the
// build) and because /embed.js needs CORS headers the static rules can't scope.
// Next 16's proxy runs on the Node runtime, so process.env is read per request
// here rather than inlined — the env-at-runtime property this relies on.
export default function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // Replaces the X-Frame-Options: SAMEORIGIN that used to live in next.config —
  // XFO has no allowlist form, so it can't coexist with partner embedding.
  // frame-ancestors is strictly stronger: the browser enforces the origin list.
  response.headers.set('Content-Security-Policy', `frame-ancestors ${getFrameAncestors()}`)
  response.headers.set('Permissions-Policy', getPermissionsPolicy())

  // The loader is fetched cross-origin by every partner page.
  if (request.nextUrl.pathname === '/embed.js') {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  }

  return response
}

export const config = {
  // Trailing slashes matter: a bare `api` prefix would also exclude /apidocs.
  matcher: ['/((?!api/|_next/static/|_next/image/|favicon.ico).*)'],
}
