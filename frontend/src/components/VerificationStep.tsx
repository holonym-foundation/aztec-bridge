'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import TextButton from './TextButton'
import { useAttestationCheck } from '@/hooks/useAttestationCheck'
import { POCH_MINT_URL } from '@/config'

const PASSPORT_BUILD_URL = 'https://app.passport.xyz/'

interface VerificationStepProps {
  onClose: () => void
  // `upgrade` = a Passport-verified user who hit the $1,000 Travel Rule cap and
  // asked to bridge more. Success then requires a valid Proof of Clean Hands, not
  // the Passport credential they already hold. `initial` is the first-time flow.
  intent?: 'initial' | 'upgrade'
}

const VerificationStep: React.FC<VerificationStepProps> = ({ onClose, intent = 'initial' }) => {
  const attestation = useAttestationCheck()
  const data = attestation.data
  const eligible = !!data?.eligible
  const checking = attestation.isFetching

  const pochEligible = data?.method === 'poch' && !!data?.eligible
  // Upgrade success gate is stricter: only a valid PoCH counts. Being Passport-
  // eligible (which `eligible` already is for these users) must NOT flip to success.
  const showSuccess = intent === 'upgrade' ? pochEligible : eligible

  // Manual re-check spinner, kept separate from `isFetching` so the background
  // upgrade poll below doesn't make the fallback button flicker every tick.
  const [isRechecking, setIsRechecking] = useState(false)
  const recheckLoading = intent === 'upgrade' ? isRechecking : checking

  // Tracks the outcome of a manual re-check so we can confirm it ran even when
  // the result is unchanged. `n` bumps each attempt so the banner re-animates.
  const [recheck, setRecheck] = useState<{ n: number; status: 'blocked' | 'error' } | null>(null)

  // Background poll: while the upgrade screen is open and PoCH is not yet detected,
  // refetch on an interval and on tab focus so returning from the external mint tab
  // advances to success without a manual click. Stops on success and on unmount.
  const refetch = attestation.refetch
  const shouldPoll = intent === 'upgrade' && !pochEligible
  useEffect(() => {
    if (!shouldPoll) return
    const id = setInterval(() => {
      refetch()
    }, 5000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [shouldPoll, refetch])

  const handleRecheck = async () => {
    setRecheck(null)
    setIsRechecking(true)
    const res = await attestation.refetch()
    setIsRechecking(false)
    const ok = intent === 'upgrade' ? res.data?.method === 'poch' && !!res.data?.eligible : !!res.data?.eligible
    if (ok) return // success view takes over
    setRecheck((prev) => ({ n: (prev?.n ?? 0) + 1, status: res.data ? 'blocked' : 'error' }))
  }

  const methodLabel =
    data?.method === 'poch' ? 'Proof of Clean Hands' : data?.method === 'passport' ? 'Human Passport' : null

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ ease: 'easeInOut', duration: 0.3 }}
      className="absolute inset-0 z-20 flex flex-col rounded-xl bg-white"
    >
      <div className="flex items-center gap-2 px-5 pt-5 pb-4">
        <button
          onClick={onClose}
          aria-label="Back to bridge"
          className="rounded-md p-1 text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
        >
          <Icon icon="ph:arrow-left" width={20} height={20} />
        </button>
        <h2 className="text-[16px] font-semibold text-[#0A0A0A]">
          {intent === 'upgrade' ? 'Upgrade to Clean Hands' : 'Verify you’re human'}
        </h2>
      </div>

      {showSuccess ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#DBFAAE]">
            <Icon icon="ph:check-bold" width={28} height={28} className="text-[#2F5214]" />
          </span>
          <div>
            <p className="text-[16px] font-semibold text-[#0A0A0A]">You’re verified</p>
            {methodLabel && <p className="mt-1 text-[13px] text-[#737373]">Verified via {methodLabel}</p>}
          </div>
          <TextButton onClick={onClose} className="mt-2 h-12 px-8">
            Continue to bridge
          </TextButton>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-5">
            {intent === 'upgrade' ? (
              <>
                <p className="text-[13px] leading-[19px] text-[#737373]">
                  You’re verified with Human Passport, which lets you bridge up to{' '}
                  <span className="font-medium text-[#0A0A0A]">$1,000</span>. To bridge more, complete{' '}
                  <span className="font-medium text-[#0A0A0A]">Proof of Clean Hands</span> once. It’s a
                  privacy-preserving proof with no per-transaction limit.
                </p>

                {/* Single primary path: Proof of Clean Hands. Passport is intentionally
                    omitted here — the user already holds it. */}
                <a
                  href={POCH_MINT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-[#D4D4D4] p-3 transition-colors hover:border-[#0A0A0A]"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">Get your Proof of Clean Hands</p>
                    <p className="mt-1 text-[12px] leading-[17px] text-[#737373]">
                      Opens id.human.tech in a new tab. We’ll detect it automatically when you come back.
                    </p>
                  </div>
                  <Icon
                    icon="ph:arrow-up-right"
                    width={16}
                    height={16}
                    className="flex-shrink-0 text-latest-blue-100"
                  />
                </a>

                <p className="mt-3 text-[11px] leading-[16px] text-[#737373]">
                  Checking automatically for your Proof of Clean Hands. It can take a moment to propagate after you
                  mint.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] leading-[19px] text-[#737373]">
                  A one-time humanity check is required before your first bridge. It keeps the network compliant and
                  sybil-resistant. Complete <span className="font-medium text-[#0A0A0A]">either</span> option below,
                  then re-check.
                </p>

                {/* Option 1: POCH */}
                <div className="mt-4 rounded-[12px] border border-[#D4D4D4] p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">Proof of Clean Hands</p>
                    <span className="rounded-full bg-[#E5EFFF] px-1.5 py-0.5 text-[10px] font-semibold text-[#17235E]">
                      recommended
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-[17px] text-[#737373]">
                    A privacy-preserving proof you complete once. No per-transaction limit.
                  </p>
                  <a
                    href={POCH_MINT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-latest-blue-100 underline underline-offset-2 hover:opacity-80"
                  >
                    Get your Proof of Clean Hands
                    <Icon icon="ph:arrow-up-right" width={13} height={13} />
                  </a>
                </div>

                {/* Option 2: Human Passport */}
                <div className="mt-3 rounded-[12px] border border-[#D4D4D4] p-3">
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">Human Passport</p>
                  <p className="mt-1 text-[12px] leading-[17px] text-[#737373]">
                    Requires a Human Passport score of at least {data?.passportThreshold ?? 20}
                    {data?.passportScore != null ? ` (you have ${data.passportScore})` : ''}. Caps each transaction
                    until you upgrade to Proof of Clean Hands.
                  </p>
                  <a
                    href={PASSPORT_BUILD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-latest-blue-100 underline underline-offset-2 hover:opacity-80"
                  >
                    Build your Human Passport score
                    <Icon icon="ph:arrow-up-right" width={13} height={13} />
                  </a>
                </div>

                <p className="mt-3 text-[11px] leading-[16px] text-[#989898]">
                  Just minted? It can take a moment to propagate, so give it a few seconds before re-checking.
                </p>
              </>
            )}
          </div>

          {/* Pinned action bar */}
          <div className="border-t border-[#F0F0F0] px-5 pb-5 pt-3">
            <AnimatePresence mode="wait">
              {recheck && !recheckLoading && (
                <motion.div
                  key={recheck.n}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-2 flex items-start gap-2 rounded-[10px] bg-[#FFF3E9] px-3 py-2.5"
                >
                  <Icon icon="ph:x-circle" width={16} height={16} className="mt-0.5 flex-shrink-0 text-[#831816]" />
                  <p className="text-[12px] leading-[17px] text-[#831816]">
                    {recheck.status === 'error'
                      ? 'Couldn’t complete the check. Please try again in a moment.'
                      : intent === 'upgrade'
                        ? 'No valid Proof of Clean Hands found for your address yet. If you just minted, give it a few seconds and re-check.'
                        : 'Still not verified: no valid attestation found for your address yet. If you just completed a step, give it a few seconds and re-check.'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <TextButton onClick={handleRecheck} isLoading={recheckLoading} className="h-12 w-full">
              {recheckLoading ? 'Re-checking…' : 'I’ve completed this, re-check'}
            </TextButton>
          </div>
        </>
      )}
    </motion.div>
  )
}

export default VerificationStep
