import React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import StyledImage from './StyledImage'
import LoadingBar from './LoadingBar'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useWalletStore } from '@/stores/walletStore'

interface BridgeHeaderProps {
  onClick?: () => void
  /** Title shown in the header pill. State-dependent so the shared chrome is
   *  expressive per screen ("BRIDGE" on the bridge, "TOP UP" on /fee-juice, etc.). */
  title?: string
}

const BridgeHeader: React.FC<BridgeHeaderProps> = ({ onClick, title = 'BRIDGE' }) => {
  const router = useRouter()
  const {
    getHeaderSteps,
    getProgressSteps,
    headerStep,
    setHeaderStep
  } = useBridgeStore()

  // A transfer is in progress once an operation step is active and the flow is not terminal.
  // The reset/disconnect action (passed by consumers as `onClick`) tears down wallets and
  // reloads, which would drop the live progress view and orphan its recovery data — so it is
  // HARD-DISABLED mid-flight (issue #136), not merely confirm-gated. Idle/terminal flows reset
  // freely (the consumer's own disconnect confirm still applies there).
  const progressSteps = getProgressSteps()
  const isTransferInProgress =
    progressSteps.some((s) => s.status === 'active') && !progressSteps.every((s) => s.status === 'completed')

  // Only consumers that pass an explicit reset handler get an interactive title.
  // Purpose-built screens (e.g. /fee-juice) render it with no handler, so the title
  // is a plain, non-interactive label that can NEVER trigger a wallet disconnect/reset.
  const resettable = !!onClick

  const handleResetClick = () => {
    if (!onClick) return
    if (isTransferInProgress) return
    onClick()
  }

  const {
    isWaapConnected,
    isAztecConnected
  } = useWalletStore()

  // Update step statuses based on wallet connections
  React.useEffect(() => {
    if (isWaapConnected) {
      setHeaderStep(1, 'completed')
    } else {
      setHeaderStep(1, 'pending')
    }
    
    if (isAztecConnected) {
      setHeaderStep(2, 'completed')
    } else {
      setHeaderStep(2, 'pending')
    }
  }, [isWaapConnected, isAztecConnected, setHeaderStep])

  const steps = getHeaderSteps()

  return (
    <div className='flex w-full min-w-0 items-center gap-[12px] rounded-[136px] border border-[#D4D4D4] bg-white px-[16px] py-[4px] pl-[8px]'>
      <img
        src='/assets/svg/human.aztec.svg'
        alt=''
        className='h-[24px] w-[24px]'
      />

      <LoadingBar steps={steps} currentStep={headerStep} />
      <p
        className={`text-center text-[#0A0A0A] font-[700] text-[16px] leading-[24px] tracking-[0.32px] uppercase font-['Suisse_Intl'] ${
          !resettable ? 'cursor-default' : isTransferInProgress ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
        title={resettable && isTransferInProgress ? 'Locked during transfer to protect your funds.' : undefined}
        aria-disabled={resettable && isTransferInProgress}
        onClick={resettable ? handleResetClick : undefined}>
        {title}
      </p>
      <button
        onClick={() => router.push('/activity')}
        className='ml-auto flex items-center justify-center p-1 rounded-full hover:bg-gray-100 transition-colors'
        aria-label='Bridge activity'
      >
        <Icon icon='ph:clock-counter-clockwise' width={20} height={20} className='text-[#0A0A0A]' />
      </button>
    </div>
  )
}

export default BridgeHeader
