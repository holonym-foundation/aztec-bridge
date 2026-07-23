import React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import StyledImage from './StyledImage'
import LoadingBar from './LoadingBar'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useWalletStore } from '@/stores/walletStore'
import { useNotificationsStore } from '@/stores/useNotificationsStore'
import { useL1TokenBalance } from '@/hooks/useL1Operations'
import { useL2TokenBalance } from '@/hooks/useL2Operations'

interface BridgeHeaderProps {
  /** Title shown in the header pill. State-dependent so the shared chrome is
   *  expressive per screen ("BRIDGE" on the bridge, "TOP UP" on /fee-juice, etc.). */
  title?: string
}

// High-priority alert presentation, keyed off the notification type. Tints match
// the Messages feed (NotificationsDrawer's ICON_TINT) so the chip and the row it
// links to read as the same alert. The header pill is white in both light and
// Privacy Mode, so these on-white tints hold in either theme.
const ALERT_META: Record<'warning' | 'error', { icon: string; className: string }> = {
  warning: { icon: 'ph:warning-circle-fill', className: 'text-[#7A4A00] bg-[#FFF1D6]' },
  error: { icon: 'ph:x-circle-fill', className: 'text-[#831816] bg-[#FFEBEB]' },
}

// Open the Messages feed by clicking the same tab the peek bubble / binder tab
// toggle. Both the rail and dock NotificationsDrawer mount their tab, but only
// one is visible per breakpoint (the other sits inside a `display:none` wrapper,
// so its offsetParent is null). Click just the visible one.
const openMessages = () => {
  document.querySelectorAll<HTMLElement>('[data-messages-tab]').forEach((el) => {
    if (el.offsetParent !== null) el.click()
  })
}

const BridgeHeader: React.FC<BridgeHeaderProps> = ({ title = 'BRIDGE' }) => {
  const router = useRouter()
  const {
    getHeaderSteps,
    headerStep,
    setHeaderStep
  } = useBridgeStore()

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

  // Most-recent active (undismissed) high-priority alert. The feed is newest-first
  // (the store prepends), and `dismiss` removes rows, so the first warning/error
  // still in the list is the current alert. The found object reference is stable
  // across renders until it changes, so this selector doesn't churn.
  const currentAlert = useNotificationsStore((s) =>
    s.notifications.find((n) => n.type === 'warning' || n.type === 'error'),
  )
  const alertMeta = currentAlert ? ALERT_META[currentAlert.type as 'warning' | 'error'] : null

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

      {/* Progress-bar zone doubles as a status surface. With an active
          high-priority alert it becomes a tappable chip that opens Messages;
          otherwise it renders the progress bar exactly as before. Fixed to the
          mini bar's height, so the title truncates and never wraps. */}
      {currentAlert && alertMeta ? (
        <button
          type='button'
          onClick={openMessages}
          aria-label={`${currentAlert.type === 'error' ? 'Error' : 'Warning'}: ${currentAlert.title}. Open messages`}
          className={`flex min-w-0 flex-1 items-center gap-[6px] rounded-full px-[10px] py-[3px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/[0.2] ${alertMeta.className}`}
        >
          <Icon
            icon={alertMeta.icon}
            width={14}
            height={14}
            className='shrink-0 animate-pulse motion-reduce:animate-none'
          />
          <span className="min-w-0 truncate text-left text-[12px] font-[600] leading-[16px] tracking-[0.2px] font-['Suisse_Intl']">
            {currentAlert.title}
          </span>
        </button>
      ) : (
        <LoadingBar steps={steps} currentStep={headerStep} />
      )}
      <div className='flex min-w-0 items-center'>
        <p className="shrink-0 cursor-default text-center text-[#0A0A0A] font-[700] text-[16px] leading-[24px] tracking-[0.32px] uppercase font-['Suisse_Intl']">
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
