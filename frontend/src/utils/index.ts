import {
  createSigningMessage,
  deriveEncryptionKey,
  decryptData,
  buildDepositExport,
  buildWithdrawalExport,
  getDepositById,
  getWithdrawalById,
  STORAGE_KEYS,
} from '@human.tech/clean.sdk'
import { getAllowedAppOrigins, isAllowedAppOrigin, normalizeAppOrigin } from '@/lib/domainAllowlist'

// Frontend-only anti-phishing guard: only prompt for encryption signatures on our domain.
// This is NOT an SDK concern — the SDK is domain-agnostic.
function isDevelopmentOrigin(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

/**
 * Verify the current page origin is allowed for encryption key derivation.
 * Prevents phishing sites from tricking users into signing key-derivation messages.
 * Must be called in the frontend before any signMessage used for encryption.
 */
export function verifyEncryptionDomain(): void {
  if (typeof window === 'undefined') return // SSR — skip
  const origin = normalizeAppOrigin(window.location.origin)
  if (isAllowedAppOrigin(origin) || isDevelopmentOrigin()) return
  const allowedOrigins = Array.from(getAllowedAppOrigins()).join(', ')
  throw new Error(
    `Security Error: Encryption key derivation is only allowed on ${allowedOrigins}. ` +
      `Current origin: ${origin}.`,
  )
}

export const truncateDecimals = (value: number | string, decimals = 6): number => {
  const [integerPart, decimalPart] = value.toString().split('.')

  return parseFloat(`${integerPart}.${decimalPart?.slice(0, decimals) || '0000'}`)
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Extract a human-readable error message from any thrown value.
 * Handles Error instances, wallet provider objects (plain { message, code } objects),
 * and falls back to String() for primitives.
 */
export function extractErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  if (typeof error === 'string') return error
  return fallback
}

/**
 * Serialize Aztec NodeInfo to a plain JSON-serializable object for storage/export.
 * Converts address-like values (EthAddress, etc.) to string.
 */
export function serializeNodeInfo(
  nodeInfo:
    | {
        nodeVersion?: string
        l1ChainId?: number
        rollupVersion?: number
        enr?: string
        l1ContractAddresses?: Record<string, unknown>
        protocolContractAddresses?: Record<string, unknown>
      }
    | null
    | undefined,
): Record<string, unknown> | null {
  if (nodeInfo == null) return null
  const toPlain = (obj: unknown): unknown => {
    if (obj == null) return obj
    if (
      typeof obj === 'object' &&
      obj !== null &&
      'toString' in obj &&
      typeof (obj as { toString: () => string }).toString === 'function'
    ) {
      const s = (obj as { toString: () => string }).toString()
      if (s && s !== '[object Object]') return s
    }
    if (Array.isArray(obj)) return obj.map(toPlain)
    if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toPlain(v)]))
    }
    return obj
  }
  return {
    nodeVersion: nodeInfo.nodeVersion,
    l1ChainId: nodeInfo.l1ChainId,
    rollupVersion: nodeInfo.rollupVersion,
    enr: nodeInfo.enr,
    l1ContractAddresses:
      nodeInfo.l1ContractAddresses != null
        ? (toPlain(nodeInfo.l1ContractAddresses) as Record<string, unknown>)
        : undefined,
    protocolContractAddresses:
      nodeInfo.protocolContractAddresses != null
        ? (toPlain(nodeInfo.protocolContractAddresses) as Record<string, unknown>)
        : undefined,
  } as Record<string, unknown>
}

/**
 * Export data as JSON file for backup
 */
export const exportToJsonFile = (data: any, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      return successful
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      return false
    }
  }
}

/**
 * Decrypt a field from an encrypted localStorage entry.
 * Shared by copyClaimSecret (L1→L2) and copyNonce (L2→L1).
 *
 * Looks up the entry via the SDK's storage helpers (getDepositById /
 * getWithdrawalById) rather than reading localStorage directly — matches the
 * canonical storage shape the SDK writes.
 */
export async function decryptStorageEntry(
  storageKey: string,
  entryId: string,
  fieldName: string,
  signMessage: (message: string, address: string) => Promise<string>,
): Promise<{ value: string; entry: any } | null> {
  verifyEncryptionDomain()

  const entry = storageKey.includes('deposits') ? getDepositById(entryId) : getWithdrawalById(entryId)
  if (!entry?.encryptedCiphertext) return null

  const signingMessage = createSigningMessage(entry.l1Address, entry.keyDerivationDomain)
  const signature = await signMessage(signingMessage, entry.l1Address)
  const encryptionKey = await deriveEncryptionKey(entry.l1Address, signature, entry.keyDerivationDomain)
  const decrypted = JSON.parse(
    await decryptData(entry.encryptedCiphertext, entry.encryptedIv, entry.encryptedTag, encryptionKey),
  )

  const value = decrypted[fieldName]
  if (!value) return null

  return { value, entry }
}

/** Trigger a browser download of the L1→L2 claim recovery JSON. */
export const exportClaimData = (claimData: any) => {
  const payload = buildDepositExport(claimData)
  exportToJsonFile(payload, `shield-human-tech-claim-${claimData.id}-${Date.now()}.json`)
}

/** Trigger a browser download of the L2→L1 withdrawal recovery JSON. */
export const exportWithdrawalData = (withdrawalData: any) => {
  const payload = buildWithdrawalExport(withdrawalData)
  exportToJsonFile(payload, `shield-human-tech-withdrawal-${withdrawalData.id}-${Date.now()}.json`)
}

// ─── Backup import (inverse of exportClaimData / exportWithdrawalData) ────────

export type BridgeDirectionTag = 'L1_TO_L2' | 'L2_TO_L1'

export interface ParsedBackupEntry {
  direction: BridgeDirectionTag
  /** Storage-shaped entry (canonical SDK deposit/withdrawal record). */
  entry: Record<string, any>
}

/** Thrown by parseBackup with a user-facing message when a file is malformed. */
export class BackupParseError extends Error {}

function coerceEntryFields(raw: Record<string, any>): Record<string, any> {
  // Normalize legacy ciphertext/iv/tag names to the encrypted* names the SDK
  // storage + decryptOperationPayload expect. Non-destructive: keep everything else.
  const entry: Record<string, any> = { ...raw }
  if (entry.encryptedCiphertext == null && raw.ciphertext != null) entry.encryptedCiphertext = raw.ciphertext
  if (entry.encryptedIv == null && raw.iv != null) entry.encryptedIv = raw.iv
  if (entry.encryptedTag == null && raw.tag != null) entry.encryptedTag = raw.tag
  return entry
}

function inferBackupDirection(entry: Record<string, any>): BridgeDirectionTag | null {
  if (entry.direction === 'L1_TO_L2' || entry.direction === 'L2_TO_L1') return entry.direction
  // L1→L2 deposits carry a claim secret hash / L1 inbox message hash.
  if (entry.claimSecretHash != null || entry.messageHash != null || entry.messageLeafIndex != null) return 'L1_TO_L2'
  // L2→L1 withdrawals carry L2 tx / outbox proof data.
  if (
    entry.l2TxHash != null ||
    entry.l2BlockNumber != null ||
    entry.l2ToL1MessageIndex != null ||
    entry.siblingPath != null ||
    entry.bridgeAddressL2 != null ||
    entry.l2BridgeAddress != null
  ) {
    return 'L2_TO_L1'
  }
  return null
}

function normalizeBackupItem(item: any): ParsedBackupEntry {
  if (item == null || typeof item !== 'object') {
    throw new BackupParseError('Backup file does not contain a valid recovery object.')
  }

  // Wrapped export shape: { type, timestamp, warning, data }. Otherwise treat the
  // object itself as a raw storage entry (legacy / hand-edited files).
  const isWrapped = item.data != null && typeof item.data === 'object' && ('type' in item || 'warning' in item)
  const source = isWrapped ? item.data : item

  const entry = coerceEntryFields(source)

  const hasEncryption =
    entry.encryptedCiphertext != null && entry.encryptedIv != null && entry.encryptedTag != null
  if (!hasEncryption) {
    throw new BackupParseError(
      'Backup is missing encrypted payload (encryptedCiphertext / encryptedIv / encryptedTag).',
    )
  }
  if (entry.keyDerivationDomain == null) {
    throw new BackupParseError('Backup is missing keyDerivationDomain; it cannot be decrypted.')
  }

  const direction =
    (item.type === 'L1_TO_L2' || item.type === 'L2_TO_L1' ? item.type : null) ?? inferBackupDirection(entry)
  if (!direction) {
    throw new BackupParseError('Could not determine bridge direction (L1→L2 vs L2→L1) from this backup.')
  }

  // Canonical storage key is `id`. Deposits carry it; withdrawal exports omit it,
  // so fall back to l2TxHash as a stable, dedupe-able identifier.
  const id = entry.id ?? entry.operationId ?? (direction === 'L2_TO_L1' ? entry.l2TxHash : null)
  if (id == null) {
    throw new BackupParseError('Backup has no operation id and no fallback identifier; cannot import.')
  }
  entry.id = String(id)

  return { direction, entry }
}

/**
 * Parse + validate an exported backup (single object or array of them) into
 * normalized, storage-shaped entries. Throws BackupParseError on malformed input.
 */
export function parseBackup(parsed: unknown): ParsedBackupEntry[] {
  const items = Array.isArray(parsed) ? parsed : [parsed]
  if (items.length === 0) throw new BackupParseError('Backup file is empty.')
  return items.map(normalizeBackupItem)
}

/**
 * Merge parsed backup entries into the SDK's localStorage (the same arrays
 * getDeposits / getWithdrawals read), deduping by operation id. Returns counts.
 */
export function importBackup(items: ParsedBackupEntry[]): { imported: number; skipped: number } {
  if (typeof window === 'undefined') return { imported: 0, skipped: 0 }

  const grouped = new Map<string, ParsedBackupEntry[]>()
  for (const it of items) {
    const key = it.direction === 'L1_TO_L2' ? STORAGE_KEYS.deposits : STORAGE_KEYS.withdrawals
    const bucket = grouped.get(key) ?? []
    bucket.push(it)
    grouped.set(key, bucket)
  }

  let imported = 0
  let skipped = 0

  for (const [key, bucket] of grouped) {
    let arr: any[]
    try {
      const rawStore = localStorage.getItem(key)
      arr = rawStore ? JSON.parse(rawStore) : []
      if (!Array.isArray(arr)) arr = []
    } catch {
      arr = []
    }

    const ids = new Set(arr.map((e) => String(e?.id ?? e?.operationId)))
    for (const { entry } of bucket) {
      const id = String(entry.id)
      if (ids.has(id)) {
        skipped++
        continue
      }
      arr.push(entry)
      ids.add(id)
      imported++
    }

    localStorage.setItem(key, JSON.stringify(arr))
  }

  return { imported, skipped }
}
