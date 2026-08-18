'use client'

import { getEmbedContext } from './mode'

type StorageAccessState = 'unknown' | 'granted' | 'denied' | 'unsupported'

let state: StorageAccessState = 'unknown'
let inFlight: Promise<StorageAccessState> | null = null

export function getStorageAccessState(): StorageAccessState {
  return state
}

/**
 * Ask for unpartitioned first-party storage.
 *
 * Framed cross-origin, Shield's localStorage is partitioned per top-level site:
 * the WaaP session and the SDK's operation backups become a separate bucket for
 * every partner, and Safari can refuse access outright. The Storage Access API
 * lifts that, but only from inside a user gesture and only if the embedder
 * granted `storage-access` via Permissions-Policy (the loader sets `allow=`,
 * src/proxy.ts delegates it).
 *
 * Denial is not fatal — encrypted operation backups live server-side and their
 * key derives from Shield's own origin, so recovery still works. Callers use
 * the state to tell the user their local history is site-scoped.
 */
export async function requestStorageAccess(): Promise<StorageAccessState> {
  if (state !== 'unknown') return state
  if (inFlight) return inFlight
  if (!getEmbedContext().isEmbedded) return (state = 'granted')

  if (typeof document === 'undefined' || typeof document.requestStorageAccess !== 'function') {
    return (state = 'unsupported')
  }

  // requestStorageAccess() is called first and synchronously: awaiting
  // hasStorageAccess() before it would put an await between the user gesture and
  // the request, and stricter engines treat transient activation as spent by
  // then. A redundant request when access is already granted resolves instantly.
  const pending: Promise<StorageAccessState> = document
    .requestStorageAccess()
    .then((): StorageAccessState => (state = 'granted'))
    .catch((): StorageAccessState => (state = 'denied'))
    .finally(() => {
      inFlight = null
    })
  inFlight = pending

  return pending
}

/**
 * Non-mutating pre-check, safe to call outside a gesture. Lets a caller skip the
 * prompt entirely when access is already there.
 */
export async function hasStorageAccess(): Promise<boolean> {
  if (typeof document === 'undefined' || typeof document.hasStorageAccess !== 'function') return false
  try {
    return await document.hasStorageAccess()
  } catch {
    return false
  }
}

/**
 * Fire the request on the first real user gesture. The API rejects outside one,
 * so this cannot be done at mount.
 */
export function installStorageAccessGestureHook(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!getEmbedContext().isEmbedded) return () => {}

  // Outside the gesture, so it costs nothing: if access is already granted the
  // handler below short-circuits and no prompt is ever raised.
  void hasStorageAccess().then((granted) => {
    if (granted && state === 'unknown') state = 'granted'
  })

  // Not `{ once: true }`: that only retires the listener that fired, leaving the
  // other one live for a request that has already happened.
  const handler = () => {
    remove()
    void requestStorageAccess()
  }
  const remove = () => {
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler)
  window.addEventListener('keydown', handler)
  return remove
}
