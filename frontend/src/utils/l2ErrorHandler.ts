import { useToast } from '@/hooks/useToast'

export type L2ErrorType =
  | 'BALANCE'
  | 'NODE'
  | 'CONTRACT'
  | 'TRANSACTION'
  | 'GENERAL'

export const useL2ErrorHandler = () => {
  const notify = useToast()

  const handleError = <T>(error: unknown, type: L2ErrorType = 'GENERAL'): T => {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Log the error for debugging
    console.error(`L2 ${type} Error:`, error)

    // Operation-specific messages
    const operationMessages = {
      BALANCE: 'Failed to load the balance',
      NODE: 'Failed to connect to the node',
      CONTRACT: 'Failed to interact with the contract',
      TRANSACTION: 'Failed to process the transaction',
      GENERAL: 'An error occurred',
    }

    let fullMessage = ''

    // Check for Aztec network server error
    if (
      errorMessage.includes(
        '500 from server https://aztec-alpha-testnet-fullnode.zkv.xyz/'
      )
    ) {
      fullMessage =
        'Unable to connect to Aztec network. The bridge service is temporarily unavailable. Please check back later'
      fullMessage = `${operationMessages[type]} - ${fullMessage}`
    } else {
      fullMessage = `${operationMessages[type]} - ${errorMessage}`
    }

    // Combine operation message with error case message and actual error
    // const fullMessage = `${operationMessages[type]} - ${errorMessage}`
    notify('error', fullMessage)

    // Return a default value based on the operation type
    switch (type) {
      case 'BALANCE':
        return { publicBalance: '0', privateBalance: '0' } as T
      case 'NODE':
        return 0 as T
      case 'CONTRACT':
        return null as T
      case 'TRANSACTION':
        return null as T
      default:
        return null as T
    }
  }

  return handleError
}
