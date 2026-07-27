import { NextRequest } from 'next/server'

import { E2E_ENV } from './env'

export interface CallOptions {
  method?: string
  body?: unknown
  token?: string
  headers?: Record<string, string>
  /** Query string appended to the url, without the leading `?`. */
  query?: string
}

// The nonce route rate-limits per client IP through a process-wide map that no
// truncation clears, so every request gets its own address unless a test pins
// one on purpose.
let clientIpCounter = 0
function nextClientIp(): string {
  clientIpCounter++
  return `10.${(clientIpCounter >> 16) & 0xff}.${(clientIpCounter >> 8) & 0xff}.${clientIpCounter & 0xff}`
}

/**
 * Build the NextRequest a route handler receives.
 *
 * The Host header carries the configured SIWE domain: handlers read it to
 * decide whether the request came from an allowed origin, and a localhost host
 * would silently open the dev exceptions the production checks rely on.
 */
export function buildRequest(path: string, options: CallOptions = {}): NextRequest {
  const { method = 'GET', body, token, headers = {}, query } = options

  const url = `https://${E2E_ENV.AUTH_EXPECTED_DOMAIN}${path}${query ? `?${query}` : ''}`
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method,
    headers: {
      host: E2E_ENV.AUTH_EXPECTED_DOMAIN,
      'x-forwarded-for': nextClientIp(),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }
  if (body !== undefined) init.body = JSON.stringify(body)

  return new NextRequest(url, init)
}

export interface CallResult<T = any> {
  status: number
  body: T
  text: string
}

/** Invoke a route handler and decode its response. */
export async function call<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<Response> | Response,
  path: string,
  options: CallOptions = {},
  context?: any,
): Promise<CallResult<T>> {
  const response = await handler(buildRequest(path, options), context)
  const text = await response.text()

  let body: any = undefined
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }

  return { status: response.status, body, text }
}

/** Route context for a dynamic segment, which Next 16 passes as a promise. */
export function routeParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) }
}
