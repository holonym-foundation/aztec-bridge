'use client'

import { Icon } from '@iconify/react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import { useWalletStore } from '@/stores/walletStore'

// Sticky, non-auto-dismissing prompt shown while a wallet signature/approval is
// being awaited (#408 / T1). The wallet popup is easy to miss, and a missed
// popup is the top abandonment driver — so this bar stays up until the request
// resolves or rejects (pendingSignature is cleared in walletStore's finally),
// and it flips the tab title so a user who tabbed away is pulled back.
//
// Placement (SOP §392): a slim bar just under the nav, IN FLOW — it reflows the
// card region down rather than overlaying it, so it can never occlude the card
// CTA. Brand tokens: maroon #81133B field, ivory text, ph:pen icon.
export default function SignaturePrompt() {
  const pendingSignature = useWalletStore((s) => s.pendingSignature)
  const reduce = useReducedMotion() ?? false
  const isPending = !!pendingSignature

  // Tab-title flip while a signature is pending; restore on clear. Guarded for
  // SSR even though effects only run client-side.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isPending) return
    const original = document.title
    document.title = 'Signature needed - Shield'
    return () => {
      document.title = original
    }
  }, [isPending])

  return (
    <AnimatePresence initial={false}>
      {pendingSignature && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.25, ease: 'easeInOut' }}
          className="relative z-30 w-full overflow-hidden bg-[#81133B] text-white"
        >
          <div className="flex w-full items-center justify-center gap-3 px-4 py-2.5">
            <Icon icon="ph:pen" width={18} height={18} className="shrink-0 text-white" />
            <span className="text-sm font-semibold">
              Signature needed. Check your wallet to continue.
            </span>
            {pendingSignature.onReRequest && (
              <button
                type="button"
                onClick={() => pendingSignature.onReRequest?.()}
                className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#81133B] transition-opacity duration-150 hover:opacity-80 motion-reduce:transition-none"
              >
                <Icon icon="ph:wallet" width={14} height={14} className="text-[#81133B]" />
                Re-request
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
