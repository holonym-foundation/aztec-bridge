import React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
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
// the Messages feed (NotificationsDrawer's ICON_TINT) so the ticker and the row it
// links to read as the same alert. The header pill is white in both light and
// Privacy Mode, so these on-white tints hold in either theme.
const ALERT_META: Record<'warning' | 'error', { icon: string; className: string }> = {
  warning: { icon: 'ph:warning-circle-fill', className: 'text-[#7A4A00] bg-[#FFF1D6]' },
  error: { icon: 'ph:x-circle-fill', className: 'text-[#831816] bg-[#FFEBEB]' },
}

// Marquee travels one full copy (translateX(-50%) across two stacked copies), so
// the loop is seamless. Slower is calmer; px/sec keeps long and short alerts at a
// constant reading speed. Only mounted while a scrolling ticker is on screen.
const TICKER_KEYFRAMES =
  '@keyframes bridge-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}'
const TICKER_SPEED_PX_PER_S = 42
const TICKER_MIN_DURATION_S = 8
const TICKER_GAP_PX = 44

// Surface "Refreshing…" for at most this long, then force it off even if the
// balance query is still in flight. The balance hooks poll on a 30s/60s
// refetchInterval, so `isFetching` re-asserts on every routine background poll;
// on a slow node that read as a permanent, stuck "Refreshing…". Capping the
// visible window keeps it a brief, honest heads-up that never sits indefinitely.
const REFRESH_VISIBLE_CAP_MS = 5000

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
  const { isFetching: l1TokenIsFetching } = useL1TokenBalance()
  const { isFetching: l2IsFetching } = useL2TokenBalance()
  const isRefreshing = l1TokenIsFetching || l2IsFetching

  // Bounded mirror of `isRefreshing`. Shows when a fetch starts, but a hard cap
  // forces it off so a long-running or perpetually-repolling query can never look
  // stuck. Hides immediately if the fetch finishes before the cap.
  const [showRefreshing, setShowRefreshing] = React.useState(false)
  const refreshCapRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (isRefreshing) {
      setShowRefreshing(true)
      if (!refreshCapRef.current) {
        refreshCapRef.current = setTimeout(() => {
          setShowRefreshing(false)
          refreshCapRef.current = null
        }, REFRESH_VISIBLE_CAP_MS)
      }
    } else {
      setShowRefreshing(false)
      if (refreshCapRef.current) {
        clearTimeout(refreshCapRef.current)
        refreshCapRef.current = null
      }
    }
    return () => {
      if (refreshCapRef.current) {
        clearTimeout(refreshCapRef.current)
        refreshCapRef.current = null
      }
    }
  }, [isRefreshing])

  // Most-recent active (undismissed) high-priority alert. The feed is newest-first
  // (the store prepends), and `dismiss` removes rows, so the first warning/error
  // still in the list is the current alert. The found object reference is stable
  // across renders until it changes, so this selector doesn't churn.
  const currentAlert = useNotificationsStore((s) =>
    s.notifications.find((n) => n.type === 'warning' || n.type === 'error'),
  )
  const alertMeta = currentAlert ? ALERT_META[currentAlert.type as 'warning' | 'error'] : null
  const isAlertActive = !!(currentAlert && alertMeta)

  // Single-line ticker text. Message adds context after the title when present;
  // middot keeps it one glanceable line (no em-dashes per house style).
  const tickerText = currentAlert
    ? currentAlert.message
      ? `${currentAlert.title} · ${currentAlert.message}`
      : currentAlert.title
    : ''

  // Respect reduced-motion for the marquee: when reduced, the ticker never
  // scrolls, it just truncates. matchMedia is read in an effect so SSR stays
  // deterministic (defaults to motion-on, corrected on mount).
  const [reduceMotion, setReduceMotion] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Live remaining-time for an in-progress transfer, streamed from ProgressCard via a window
  // event. ProgressCard is a sibling (not a parent) and the shared store is off-limits, so the
  // countdown crosses over here. When a countdown is live it takes the left slot in place of the
  // decorative glyph; otherwise the glyph returns. The progress screen clears it on unmount.
  const [remainingTime, setRemainingTime] = React.useState<string | null>(null)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ remaining: string | null }>).detail
      setRemainingTime(detail?.remaining ?? null)
    }
    window.addEventListener('shield:progress-timer', handler as EventListener)
    return () => window.removeEventListener('shield:progress-timer', handler as EventListener)
  }, [])

  // Only scroll the ticker when the text actually overflows the viewport. A
  // stable, always-mounted invisible measurer avoids the measure->switch->remeasure
  // flicker that comes from measuring the moving marquee itself.
  const tickerViewportRef = React.useRef<HTMLDivElement>(null)
  const tickerMeasureRef = React.useRef<HTMLSpanElement>(null)
  const [tickerScroll, setTickerScroll] = React.useState(false)
  const [tickerContentWidth, setTickerContentWidth] = React.useState(0)

  React.useEffect(() => {
    if (!isAlertActive) {
      setTickerScroll(false)
      return
    }
    const viewport = tickerViewportRef.current
    const measure = tickerMeasureRef.current
    if (!viewport || !measure) return
    const check = () => {
      const contentWidth = measure.scrollWidth
      setTickerContentWidth(contentWidth)
      setTickerScroll(!reduceMotion && contentWidth > viewport.clientWidth + 1)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(viewport)
    return () => ro.disconnect()
  }, [isAlertActive, tickerText, reduceMotion])

  const tickerDurationS = Math.max(
    TICKER_MIN_DURATION_S,
    (tickerContentWidth + TICKER_GAP_PX) / TICKER_SPEED_PX_PER_S,
  )

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

  const tickerTextClass =
    "whitespace-nowrap text-[12px] font-[600] leading-[16px] tracking-[0.2px] font-['Suisse_Intl']"

  return (
    <div className='flex w-full min-w-0 items-center gap-[12px] rounded-[136px] border border-[#D4D4D4] bg-white px-[16px] py-[4px] pl-[8px]'>
      {isAlertActive && alertMeta ? (
        // ACTIVE: a live warning/error message takes over the bar as a compact
        // single-line ticker. The brain glyph and the "BRIDGE" label are hidden to
        // make room; the whole ticker is one tap target that opens Messages.
        <button
          type='button'
          onClick={openMessages}
          aria-label={`${currentAlert!.type === 'error' ? 'Error' : 'Warning'}: ${tickerText}. Open messages`}
          className={`group flex min-w-0 flex-1 items-center gap-[8px] rounded-full px-[10px] py-[4px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/[0.2] ${alertMeta.className}`}
        >
          <Icon
            icon={alertMeta.icon}
            width={14}
            height={14}
            className='shrink-0 animate-pulse motion-reduce:animate-none'
          />
          <div
            ref={tickerViewportRef}
            aria-hidden='true'
            className='relative min-w-0 flex-1 overflow-hidden text-left'
          >
            {/* Always-mounted, out-of-flow width probe used to decide overflow. */}
            <span
              ref={tickerMeasureRef}
              className={`invisible absolute left-0 top-0 ${tickerTextClass}`}
            >
              {tickerText}
            </span>
            {tickerScroll ? (
              <>
                <style dangerouslySetInnerHTML={{ __html: TICKER_KEYFRAMES }} />
                <div
                  className='flex w-max [mask-image:linear-gradient(to_right,transparent,#000_12px,#000_calc(100%-12px),transparent)]'
                  style={{ animation: `bridge-ticker ${tickerDurationS}s linear infinite` }}
                >
                  <span className={`${tickerTextClass}`} style={{ paddingRight: TICKER_GAP_PX }}>
                    {tickerText}
                  </span>
                  <span className={`${tickerTextClass}`} style={{ paddingRight: TICKER_GAP_PX }}>
                    {tickerText}
                  </span>
                </div>
              </>
            ) : (
              <span className={`block truncate ${tickerTextClass}`}>{tickerText}</span>
            )}
          </div>
        </button>
      ) : (
        // IDLE: live countdown (or the glyph when none) + progress bar + "BRIDGE" label.
        <>
          {remainingTime ? (
            <div
              className='flex shrink-0 items-center gap-[4px]'
              role='timer'
              aria-label={`Estimated time remaining ${remainingTime}`}
              title='Estimated time remaining'
            >
              <Icon
                icon='ph:clock-countdown'
                width={18}
                height={18}
                className='shrink-0 animate-pulse text-[#0A0A0A] motion-reduce:animate-none'
              />
              <span className="text-[13px] font-[600] leading-[16px] tracking-[0.2px] tabular-nums text-[#0A0A0A] font-['Suisse_Intl']">
                ~{remainingTime}
              </span>
            </div>
          ) : (
            <img
              src='/assets/svg/human.aztec.svg'
              alt=''
              className='h-[24px] w-[24px] shrink-0'
            />
          )}

          <LoadingBar steps={steps} currentStep={headerStep} />

          <div className='flex min-w-0 items-center'>
            <p className="shrink-0 cursor-default text-center text-[#0A0A0A] font-[700] text-[16px] leading-[24px] tracking-[0.32px] uppercase font-['Suisse_Intl']">
              {title}
            </p>
            {/* Balance-refresh status. Collapses to zero width when idle (no layout
                shift), fades + expands into the empty space beside the title while a
                balance query is fetching. Bounded by REFRESH_VISIBLE_CAP_MS so it
                can never sit visibly "Refreshing…" indefinitely. Spinner holds still
                under reduced motion. */}
            <span
              role='status'
              aria-live='polite'
              aria-hidden={!showRefreshing}
              className={`flex items-center overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
                showRefreshing ? 'ml-[8px] max-w-[140px] opacity-100' : 'ml-0 max-w-0 opacity-0'
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
        </>
      )}
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
