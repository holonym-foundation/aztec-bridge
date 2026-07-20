import { AUTH_EXPECTED_DOMAIN } from '@/config/env.config'

const DEFAULT_ALLOWED_HOSTS = ['shield.human.tech', 'testnet.shield.human.tech']

function normalizeHost(host: string): string {
  return host.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

export function getAllowedAppHosts(): Set<string> {
  const hosts = new Set(DEFAULT_ALLOWED_HOSTS)
  for (const part of AUTH_EXPECTED_DOMAIN.split(',')) {
    const host = normalizeHost(part)
    if (host) hosts.add(host)
  }
  return hosts
}

export function getAllowedAppOrigins(): Set<string> {
  return new Set(Array.from(getAllowedAppHosts(), (host) => `https://${host}`))
}

export function isAllowedAppOrigin(origin: string): boolean {
  return getAllowedAppOrigins().has(normalizeOrigin(origin))
}

export function normalizeAppOrigin(origin: string): string {
  return normalizeOrigin(origin)
}
