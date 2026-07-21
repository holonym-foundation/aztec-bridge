/**
 * Client-side memory of L1 ↔ L2 address pairs the user has already authenticated
 * on this device.
 *
 * Device-local only (localStorage) — nothing is sent to any server. The 1:1
 * binding lives authoritatively in Postgres; this is just a UX cache so the UI
 * can pre-warn about the correct pair (e.g. "this L1 is already linked to a
 * different L2 on this device") before a server round-trip returns a conflict.
 *
 * All reads are defensive: any parse/storage failure degrades to "no memory"
 * rather than throwing, so a corrupt entry can never break a render.
 */

const STORAGE_KEY = 'shield-human-tech-known-bindings'

export interface KnownBinding {
  l1: string
  l2: string
}

function normalize(address: string): string {
  return address.trim().toLowerCase()
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readAll(): KnownBinding[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (b): b is KnownBinding =>
        b != null && typeof b === 'object' && typeof b.l1 === 'string' && typeof b.l2 === 'string',
    )
  } catch {
    return []
  }
}

function writeAll(bindings: KnownBinding[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
  } catch {
    // Storage full / disabled (private mode) — memory is best-effort, so ignore.
  }
}

/**
 * Record an authenticated L1 ↔ L2 pair. Idempotent; addresses are stored
 * lowercased. Replaces any prior entry that referenced either side so the
 * device memory always reflects the latest confirmed pairing.
 */
export function rememberBinding(l1: string, l2: string): void {
  if (!l1 || !l2) return
  const nl1 = normalize(l1)
  const nl2 = normalize(l2)
  const next = readAll().filter((b) => b.l1 !== nl1 && b.l2 !== nl2)
  next.push({ l1: nl1, l2: nl2 })
  writeAll(next)
}

/** Return the L2 address this device has seen paired with `l1`, or null. */
export function getKnownL2ForL1(l1: string): string | null {
  if (!l1) return null
  const nl1 = normalize(l1)
  return readAll().find((b) => b.l1 === nl1)?.l2 ?? null
}

/** Return the L1 address this device has seen paired with `l2`, or null. */
export function getKnownL1ForL2(l2: string): string | null {
  if (!l2) return null
  const nl2 = normalize(l2)
  return readAll().find((b) => b.l2 === nl2)?.l1 ?? null
}

/** Return all remembered L1 ↔ L2 pairs known on this device. */
export function getAllKnownBindings(): KnownBinding[] {
  return readAll()
}
