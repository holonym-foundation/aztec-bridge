'use client'

import React from 'react'
import { Icon } from '@iconify/react'
import { useWalletStore } from '@/stores/walletStore'
import { useAttestationCheck } from '@/hooks/useAttestationCheck'
import { useExplainerStore } from '@/stores/useExplainerStore'
import { EXPLAINER_STEPS } from '@/components/model/HowItWorksModal'

type StepStatus = 'done' | 'active' | 'upcoming'

const BridgeStepsRail: React.FC = () => {
  const { isWaapConnected, isAztecConnected } = useWalletStore()
  const attestation = useAttestationCheck()
  const { openModal } = useExplainerStore()

  const bothConnected = isWaapConnected && isAztecConnected
  const eligible = !!attestation.data?.eligible
  const verifying = bothConnected && attestation.isFetching && !attestation.data

  // Single "you are here" pointer. We can reliably observe progress through
  // verification from global state; the deposit/claim step stays upcoming since
  // its live state lives in the bridge form.
  const currentStep = !bothConnected ? 0 : !eligible ? 1 : 2

  const statusFor = (index: number): StepStatus =>
    index < currentStep ? 'done' : index === currentStep ? 'active' : 'upcoming'

  const helperFor = (index: number): string | null => {
    if (index !== currentStep) return null
    if (index === 0) {
      if (isWaapConnected || isAztecConnected) return 'One wallet connected. Connect the other to continue.'
      return EXPLAINER_STEPS[0].body
    }
    if (index === 1) {
      if (verifying) return 'Checking your verification…'
      if (attestation.data && !attestation.data.eligible) {
        return attestation.data.reason || 'A one-time humanity check is required before your first bridge.'
      }
      return EXPLAINER_STEPS[1].body
    }
    return EXPLAINER_STEPS[index].body
  }

  return (
    <div className="w-full max-w-[360px] shrink-0 rounded-[16px] border border-[#D4D4D4] bg-white p-4 md:w-[260px]">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#989898]">Bridge in 4 steps</p>

      <ol className="flex flex-col">
        {EXPLAINER_STEPS.map((step, i) => {
          const status = statusFor(i)
          const helper = helperFor(i)
          const isLast = i === EXPLAINER_STEPS.length - 1
          return (
            <li key={step.title} className="flex gap-3">
              {/* Marker + connector */}
              <div className="flex flex-col items-center">
                <span
                  className={
                    status === 'done'
                      ? 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-white'
                      : status === 'active'
                        ? 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#17235E] bg-[#E5EFFF] text-[11px] font-semibold text-[#17235E]'
                        : 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[#D4D4D4] text-[11px] font-semibold text-[#B7B7B7]'
                  }
                >
                  {status === 'done' ? <Icon icon="ph:check-bold" width={13} height={13} /> : i + 1}
                </span>
                {!isLast && (
                  <span className={`my-1 w-px flex-1 ${status === 'done' ? 'bg-[#0A0A0A]' : 'bg-[#E5E5E5]'}`} />
                )}
              </div>

              {/* Label + active helper */}
              <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                <p
                  className={
                    status === 'upcoming'
                      ? 'text-[13px] font-medium text-[#B7B7B7]'
                      : 'text-[13px] font-semibold text-[#0A0A0A]'
                  }
                >
                  {step.title}
                </p>
                {helper && (
                  <p className="mt-0.5 text-[12px] leading-[17px] text-[#737373] break-words [overflow-wrap:anywhere]">
                    {helper}
                  </p>
                )}
                {i === 1 && status === 'active' && (
                  <button
                    onClick={openModal}
                    className="mt-1 text-[12px] font-medium text-latest-blue-100 underline underline-offset-2 hover:opacity-80 transition-opacity"
                  >
                    Why is this needed?
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-1 border-t border-[#F0F0F0] pt-3">
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#737373] hover:text-[#0A0A0A] transition-colors"
        >
          <Icon icon="ph:question" width={15} height={15} />
          See the full walkthrough
        </button>
      </div>
    </div>
  )
}

export default BridgeStepsRail
