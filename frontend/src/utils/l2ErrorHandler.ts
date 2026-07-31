import { useToast } from '@/hooks/useToast'
import { humanizeError } from '@/utils'
import { logError } from '@/utils/datadog'

export type L2ErrorType = 'BALANCE' | 'NODE' | 'CONTRACT' | 'TRANSACTION' | 'GENERAL'

function getDefaultValue<T>(type: L2ErrorType): T {
  switch (type) {
    case 'BALANCE':
      return { publicBalance: '0', privateBalance: '0' } as T
    case 'NODE':
      return 0 as T
    default:
      return null as T
  }
}

export const useL2ErrorHandler = () => {
  const notify = useToast()

  const handleError = <T>(error: unknown, type: L2ErrorType = 'GENERAL'): T => {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : typeof error === 'string'
            ? error
            : 'Unknown error'

    // Log the RAW error so it stays visible in the console and in Datadog metrics
    // even though the user only ever sees the humanized copy below.
    console.error(`L2 ${type} Error:`, error)
    logError(
      `L2 ${type} error`,
      { errorType: type, rawMessage: errorMessage },
      error instanceof Error ? error : undefined,
    )

    // Check for wallet disconnect errors — silently return defaults.
    // The disconnect handler in walletStore already shows a toast when
    // the disconnection is unexpected; showing it again per-query is noisy.
    const isWalletDisconnected = /wallet.*disconnect|disconnect.*wallet|backend.*disconnect/i.test(errorMessage)
    if (isWalletDisconnected) {
      return getDefaultValue<T>(type)
    }

    // Aztec wallet is locked — tell user to unlock it
    const isWalletLocked = /locked/i.test(errorMessage)
    if (isWalletLocked) {
      notify('warn', {
        heading: 'Aztec Wallet Locked',
        message: 'Your Aztec wallet is locked. Please open the Aztec wallet extension and unlock it to load your balances.',
      })
      return getDefaultValue<T>(type)
    }

    // Everything else is routed through the central humanizer so the raw
    // viem / contract-revert / RPC string is NEVER shown to the user. The
    // balance surface gets an operation-specific lead in front of it.
    const lead = type === 'BALANCE' ? "Couldn't load your balance right now. " : ''
    notify('error', `${lead}${humanizeError(error)}`.trim())
    return getDefaultValue<T>(type)
  }

  return handleError
}
