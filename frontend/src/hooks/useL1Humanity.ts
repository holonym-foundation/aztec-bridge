import { useQuery } from '@tanstack/react-query'
import { useBridge } from '@/hooks/useBridge'

export interface L1HumanityResult {
  eligible: boolean
  method: 'poch' | 'passport' | null
  reason?: string
  /** True when the address matched a sanctions list. */
  sanctioned?: boolean
  passportScore?: number
  passportThreshold?: number
  passportMaxAmount?: bigint
}

/**
 * L1-only humanity check for a supplied L1 address.
 *
 * Runs the same POCH → Passport cascade + sanctions screen as useAttestationCheck,
 * but keyed purely on the L1 address: no JWT, no L2 wallet, and no address binding
 * is created server-side. This lets the UI surface a human's standing the moment
 * their L1 wallet connects, before the L2 wallet is linked.
 *
 * Returns a shape compatible with useAttestationCheck's result (plus `sanctioned`)
 * so the UI can swap or merge the two. Per-user deposit-cap / Travel-Rule fields
 * are intentionally absent here — those require an authenticated session.
 */
export function useL1Humanity(l1Address?: string) {
  const bridge = useBridge()

  return useQuery<L1HumanityResult>({
    queryKey: ['l1Humanity', l1Address],
    queryFn: async (): Promise<L1HumanityResult> => {
      const data = await bridge.checkL1Eligibility(l1Address as string)
      return {
        eligible: data.eligible,
        method: data.method,
        reason: data.reason,
        sanctioned: data.sanctioned,
        passportScore: data.passportScore,
        passportThreshold: data.passportThreshold,
        passportMaxAmount: data.passportMaxAmount != null ? BigInt(data.passportMaxAmount) : undefined,
      }
    },
    enabled: !!l1Address,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
