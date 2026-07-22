import React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import StyledImage from './StyledImage'
import LoadingBar from './LoadingBar'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useWalletStore } from '@/stores/walletStore'
import { useL1TokenBalance } from '@/hooks/useL1Operations'
import { useL2TokenBalance } from '@/hooks/useL2Operations'

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

  // Inline "refreshing balances" status, sourced from the SAME balance-query
  // fetching flags BalanceCard derives its own spinner from. react-query dedupes
  // these subscriptions, so reading the hooks here adds no extra network calls.
  // It just mirrors the shared query state into the header chrome.
  const { isFetching: l1TokenIsFetching } = useL1TokenBalance()
  const { isFetching: l2IsFetching } = useL2TokenBalance()
  const isRefreshing = l1TokenIsFetching || l2IsFetching

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
      <div className='flex min-w-0 items-center'>
        <p
          className={`shrink-0 text-center text-[#0A0A0A] font-[700] text-[16px] leading-[24px] tracking-[0.32px] uppercase font-['Suisse_Intl'] ${
            !resettable ? 'cursor-default' : isTransferInProgress ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
          title={resettable && isTransferInProgress ? 'Locked during transfer to protect your funds.' : undefined}
          aria-disabled={resettable && isTransferInProgress}
          onClick={resettable ? handleResetClick : undefined}>
          {title}
        </p>
        {/* Balance-refresh status. Collapses to zero width when idle (no layout
            shift), fades + expands into the empty space beside the title while a
            balance query is fetching. Spinner holds still under reduced motion. */}
        <span
          role='status'
          aria-live='polite'
          aria-hidden={!isRefreshing}
          className={`flex items-center overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
            isRefreshing ? 'ml-[8px] max-w-[140px] opacity-100' : 'ml-0 max-w-0 opacity-0'
          }`}>
          <Icon
            icon='ph:spinner-gap-bold'
            width={12}
            height={12}
            className='shrink-0 animate-spin motion-reduce:animate-none text-[#737373]'
          />
          <span className="ml-[4px] text-[11px] font-[500] leading-[16px] tracking-[0.2px] text-[#737373] font-['Suisse_Intl']">
            Refreshing…
          </span>
        </span>
      </div>
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
