'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { useNotificationsStore, type AppNotification, type NotificationType } from '@/stores/useNotificationsStore'
import { useWalletStore } from '@/stores/walletStore'

// Motion values mirrored from the human-tech design system (docs/tokens.css):
// --dur-enter / --ease-slide for the panel that slides out from the tab.
const DS_DUR_ENTER = 0.32
const DS_EASE_SLIDE: [number, number, number, number] = [0.32, 0.72, 0, 1]

// Shared right-edge peek coordination (#160): every binder tab announces its
// open state on this event; a tab that sees ANOTHER tab open closes itself, so
// only one panel peeks/opens at a time and they never overlap. BridgeStepsRail
// and ActivityDrawer speak the same event.
const PEEK_EVENT = 'shield:peek'
type PeekSignal = { id: string; open: boolean }

const PANEL_WIDTH = 300
// Fixed page size. The panel paginates rather than scrolls, matching the app's
// no-scroll direction. Kept small (3) so the taller, roomier rows plus header and
// pager fit inside the viewport-capped panel height without clipping (#208/#229).
const PAGE_SIZE = 3

// #208/#225. One spacing scale for the Messages feed so rows and the panel
// breathe instead of crowding. Defined once and reused. PANEL_PADDING sets the
// panel's edge breathing room; PANEL_SECTION_GAP the space around the header and
// pagination footer. ROW_LAYOUT sets the icon gap and vertical padding between
// rows; ROW_STACK the consistent gap between a row's title, body, and status
// line. Change here to retune the whole feed at once.
const PANEL_PADDING = 'p-5'
const PANEL_SECTION_GAP = 'mb-4'
const PANEL_FOOTER_GAP = 'mt-4 pt-4'
const ROW_LAYOUT = 'flex gap-3.5 py-4 border-b border-[#F0F0F0] last:border-b-0 last:pb-0'
const ROW_STACK = 'min-w-0 flex-1 flex flex-col gap-2'

const ICON_FOR: Record<NotificationType, string> = {
  signature: 'ph:pen-nib',
  claim: 'ph:hand-coins',
  withdrawal: 'ph:arrow-line-up-right',
  deposit: 'ph:arrow-line-down',
  error: 'ph:warning-circle',
  info: 'ph:info',
  success: 'ph:check-circle',
  warning: 'ph:warning',
}

const ICON_TINT: Record<NotificationType, string> = {
  signature: 'text-[#17235E] bg-[#E5EFFF]',
  claim: 'text-[#2F5214] bg-[#DBFAAE]',
  withdrawal: 'text-[#81133B] bg-[#FDE7F3]',
  deposit: 'text-[#17235E] bg-[#E5EFFF]',
  error: 'text-[#831816] bg-[#FFEBEB]',
  info: 'text-[#525252] bg-[#F0F0F0]',
  success: 'text-[#2F5214] bg-[#DBFAAE]',
  warning: 'text-[#7A4A00] bg-[#FFF1D6]',
}

// ── Message state (#176) ────────────────────────────────────────────────────
// A message that asks the user to act (sign / approve / confirm) is PENDING
// until something resolves it, then it reads DONE; if it sits unresolved past
// STALE_MS it reads STALE so a "Signature required" never lingers as if still
// live after the user has already signed (or walked away).
type MessageState = 'pending' | 'done' | 'stale' | 'plain'

const RESOLVING_TYPES: NotificationType[] = ['success', 'claim', 'deposit', 'withdrawal']
const ACTION_TEXT = /\b(sign|signature|approve|confirm|awaiting|pending|action required|required)\b/i
const RESOLVED_TEXT = /\b(signed|approved|confirmed|complete|completed|success|claimed|deposited)\b/i
const STALE_MS = 3 * 60 * 1000

const isActionRequired = (n: AppNotification): boolean => {
  if (n.type === 'signature') return true
  if (n.type === 'info' || n.type === 'warning') return ACTION_TEXT.test(`${n.title} ${n.message ?? ''}`)
  return false
}

// `list` is newest-first (the store prepends). A pending action is DONE once any
// LATER message resolves it (a success/claim/deposit/withdrawal, or text that
// reads as completed) — those sit at a lower index than the pending row.
const deriveState = (list: AppNotification[], index: number, now: number): MessageState => {
  const n = list[index]
  if (!isActionRequired(n)) return 'plain'
  const resolvedAfter = list
    .slice(0, index)
    .some((m) => RESOLVING_TYPES.includes(m.type) || RESOLVED_TEXT.test(`${m.title} ${m.message ?? ''}`))
  if (resolvedAfter) return 'done'
  if (now - n.timestamp > STALE_MS) return 'stale'
  return 'pending'
}

const STATE_META: Record<Exclude<MessageState, 'plain'>, { label: string; className: string }> = {
  pending: { label: 'Action required', className: 'bg-[#E5EFFF] text-[#17235E]' },
  done: { label: 'Done', className: 'bg-[#DBFAAE] text-[#2F5214]' },
  stale: { label: 'Expired', className: 'bg-[#F0F0F0] text-[#989898]' },
}

type NotificationsDrawerProps = { variant?: 'rail' | 'dock' }

const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ variant = 'rail' }) => {
  const isDock = variant === 'dock'
  const notifications = useNotificationsStore((s) => s.notifications)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const lastGenie = useNotificationsStore((s) => s.lastGenie)
  const dismiss = useNotificationsStore((s) => s.dismiss)
  const dismissAll = useNotificationsStore((s) => s.dismissAll)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)

  const isWaapConnected = useWalletStore((s) => s.isWaapConnected)
  const connectWaapWallet = useWalletStore((s) => s.connectWaapWallet)

  const panelId = useId()
  const peekId = useId()
  const prefersReducedMotion = useReducedMotion()

  // Hover previews the panel; a click pins it open. On touch (no hover) the tap
  // toggles `pinned`, so the same handle works on every size.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [page, setPage] = useState(0)
  // The panel's bottom is anchored to the tab and it grows UPWARD (#229), so it
  // never spills below the tab into the floating chat widget. This caps its
  // height to the room actually above the tab's bottom edge, so the top row and
  // the pager always stay on-screen no matter where the tab dock sits.
  const [maxPanelHeight, setMaxPanelHeight] = useState<number | undefined>(undefined)
  // Tracks whether one of the SIBLING tabs is open, so the message peek bubble
  // never pops out over an open Tutorial/Activity panel (#160/#181).
  const [othersOpen, setOthersOpen] = useState(false)
  const open = hovered || pinned

  const drawerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)

  // Badge pulse fires on every genuinely-new message (keyed on the store's
  // lastGenie), independent of any toast animation — so it can't silently fail
  // the way the old toast-flight did (#180). Reduced-motion users get the count
  // bump with no scale animation.
  const [pulseKey, setPulseKey] = useState(0)

  // The peek bubble: a new message slides softly out of the Messages tab like an
  // iMessage chat bubble, pauses, then drops back in (#181). Important messages
  // (errors / action-required) linger; routine ones settle quickly.
  const [peek, setPeek] = useState<{ note: AppNotification; important: boolean } | null>(null)
  const seenGenieRef = useRef<string | null>(null)

  // Re-tick so time-based state (pending → stale) refreshes while the feed has
  // any action-required message the user hasn't resolved.
  const [nowTick, setNowTick] = useState(() => Date.now())
  const hasActionable = useMemo(() => notifications.some(isActionRequired), [notifications])
  useEffect(() => {
    if (!hasActionable) return
    const t = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [hasActionable])

  const stateById = useMemo(() => {
    const map = new Map<string, MessageState>()
    notifications.forEach((_, i) => map.set(notifications[i].id, deriveState(notifications, i, nowTick)))
    return map
  }, [notifications, nowTick])

  // ── Peek coordination (#160): announce our open state; close on a sibling's.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent<PeekSignal>(PEEK_EVENT, { detail: { id: peekId, open } }))
  }, [open, peekId])

  useEffect(() => {
    const onPeek = (e: Event) => {
      const detail = (e as CustomEvent<PeekSignal>).detail
      if (!detail || detail.id === peekId) return
      setOthersOpen(detail.open)
      if (detail.open) {
        setHovered(false)
        setPinned(false)
      }
    }
    window.addEventListener(PEEK_EVENT, onPeek)
    return () => window.removeEventListener(PEEK_EVENT, onPeek)
  }, [peekId])

  // ── New-message surfacing (#180/#181): pulse the badge + peek the bubble.
  useEffect(() => {
    if (!lastGenie || seenGenieRef.current === lastGenie.id) return
    seenGenieRef.current = lastGenie.id
    setPulseKey((k) => k + 1)
    if (prefersReducedMotion) return // reduced-motion: badge only, no bubble travel
    if (open || othersOpen) return // don't pop over an open panel
    const note = notifications.find((n) => n.id === lastGenie.id)
    if (!note) return
    const important = note.type === 'error' || note.type === 'signature' || note.type === 'warning'
    setPeek({ note, important })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastGenie])

  // Auto-retract the bubble (routine settles fast; important lingers).
  useEffect(() => {
    if (!peek) return
    const ms = peek.important ? 5200 : 2600
    const t = window.setTimeout(() => setPeek(null), ms)
    return () => window.clearTimeout(t)
  }, [peek])

  // Retract immediately if any panel opens while it's peeking.
  useEffect(() => {
    if (open || othersOpen) setPeek(null)
  }, [open, othersOpen])

  const closeDesktop = () => {
    setPinned(false)
    setHovered(false)
    handleRef.current?.focus()
  }

  // Opening the feed clears the unread badge — the user is now looking at it.
  useEffect(() => {
    if (open) markAllRead()
  }, [open, markAllRead])

  // Measure the space above the tab's bottom edge and cap the panel to it, so the
  // upward-growing panel is never clipped by the viewport top (or, on short
  // screens, forced to overlap the chat widget below). Re-measures on resize.
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const rect = handleRef.current?.getBoundingClientRect()
      if (!rect) return
      setMaxPanelHeight(Math.max(160, Math.round(rect.bottom - 12)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const pageCount = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE))

  // Clamp the current page when the list shrinks (dismissals) so we never land
  // on an empty page past the end.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1)
  }, [page, pageCount])

  const pageItems = useMemo(
    () => notifications.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [notifications, page],
  )

  const rangeStart = notifications.length === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min(notifications.length, page * PAGE_SIZE + PAGE_SIZE)

  // Esc + outside click close a pinned desktop drawer. Only wired up while
  // pinned so hover-only previews don't pay for a global listener.
  useEffect(() => {
    if (!pinned) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPinned(false)
      setHovered(false)
      handleRef.current?.focus()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setPinned(false)
        setHovered(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [pinned])

  const renderItem = (n: AppNotification) => {
    const state = stateById.get(n.id) ?? 'plain'
    const meta = state === 'plain' ? null : STATE_META[state]
    return (
      <li key={n.id} className={`${ROW_LAYOUT} ${state === 'stale' ? 'opacity-55' : ''}`}>
        <span
          className={`relative mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${ICON_TINT[n.type]}`}
        >
          <Icon icon={ICON_FOR[n.type]} width={13} height={13} />
          {state === 'pending' && (
            // Live pending marker. Ping is reduced-motion safe: the dot stays put,
            // only the halo animates and CSS drops it under prefers-reduced-motion.
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              {!prefersReducedMotion && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#17235E] opacity-60" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#17235E] ring-2 ring-white" />
            </span>
          )}
        </span>
        <div className={ROW_STACK}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-semibold text-[#0A0A0A] break-words [overflow-wrap:anywhere]">{n.title}</p>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss notification"
              className="-mr-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[#B7B7B7] transition-colors hover:bg-[#F0F0F0] hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81133B]/40"
            >
              <Icon icon="ph:x-bold" width={11} height={11} />
            </button>
          </div>
          {n.message && (
            <p className="text-[11px] leading-[16px] text-[#737373] break-words [overflow-wrap:anywhere]">
              {n.message}
            </p>
          )}
          {n.action && (
            <button
              type="button"
              onClick={() => n.action?.onClick()}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#E5EFFF] px-2.5 py-1.5 text-[11px] font-semibold text-[#17235E] transition-colors hover:bg-[#17235E]/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17235E]/40"
            >
              <Icon icon="ph:download-simple" width={12} height={12} />
              {n.action.label}
            </button>
          )}
          <div className="flex items-center gap-1.5">
            {meta && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.3px] ${meta.className}`}
              >
                {state === 'done' && <Icon icon="ph:check-bold" width={9} height={9} />}
                {meta.label}
              </span>
            )}
            <span className="text-[10px] font-medium uppercase tracking-[0.3px] text-[#B7B7B7]">
              {formatDistanceToNowStrict(new Date(n.timestamp), { addSuffix: true })}
            </span>
          </div>
        </div>
      </li>
    )
  }

  const emptyState = () =>
    isWaapConnected ? (
      // Connected but nothing to show — the genuine "caught up" state.
      <div className="flex flex-col items-center gap-1.5 py-6 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F0F0] text-[#B7B7B7]">
          <Icon icon="ph:bell-simple" width={18} height={18} />
        </span>
        <p className="text-[12px] font-medium text-[#737373]">You&rsquo;re all caught up</p>
        <p className="text-[11px] text-[#B7B7B7]">Signing, claims and bridge updates will show up here.</p>
      </div>
    ) : (
      // Not connected — don't imply there's nothing to see (#163). Prompt to
      // connect so messages have somewhere to come from.
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5EFFF] text-[#17235E]">
          <Icon icon="ph:plugs" width={18} height={18} />
        </span>
        <p className="text-[12px] font-medium text-[#737373]">Connect your wallet to see your messages</p>
        <button
          type="button"
          onClick={() => connectWaapWallet().catch(() => {})}
          className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg bg-[#17235E] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#17235E]/90"
        >
          <Icon icon="ph:wallet" width={14} height={14} />
          Connect wallet
        </button>
      </div>
    )

  const panelBody = (onClose?: () => void) => (
    <>
      <div className={`${PANEL_SECTION_GAP} flex shrink-0 items-center justify-between gap-2`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#989898]">Messages</p>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={dismissAll}
              className="mr-1 text-[11px] font-medium text-[#737373] transition-colors hover:text-[#0A0A0A]"
            >
              Clear all
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[#989898] transition-colors hover:bg-[#F0F0F0] hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81133B]/40"
            >
              <Icon icon="ph:x-bold" width={13} height={13} />
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        emptyState()
      ) : (
        <>
          <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">{pageItems.map(renderItem)}</ul>
          {notifications.length > 0 && (
            <div className={`${PANEL_FOOTER_GAP} flex shrink-0 items-center justify-between border-t border-[#F0F0F0]`}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Newer messages"
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#737373] transition-colors hover:bg-[#F0F0F0] hover:text-[#0A0A0A] disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon icon="ph:caret-left-bold" width={13} height={13} />
              </button>
              <span className="text-[11px] font-medium tabular-nums text-[#989898]">
                {rangeStart}&ndash;{rangeEnd} of {notifications.length}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                aria-label="Older messages"
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#737373] transition-colors hover:bg-[#F0F0F0] hover:text-[#0A0A0A] disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon icon="ph:caret-right-bold" width={13} height={13} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  )

  // Narrow-viewport dock (#243): a compact round icon button in the bottom-left
  // mobile dock. Keeps the envelope identity + the unread count badge (with its
  // pulse) and opens the same Messages feed as a bottom-anchored sheet that stays
  // on-screen on phones. The new-message peek bubble is a right-edge affordance,
  // so it is dropped here; the badge pulse still surfaces new messages.
  if (isDock) {
    return (
      <div
        ref={drawerRef}
        className="pointer-events-auto relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
              className="fixed bottom-[76px] left-4 z-40 w-[300px] max-w-[calc(100vw-2rem)]"
            >
              <div
                id={panelId}
                className={`flex max-h-[70dvh] flex-col rounded-[16px] border border-[#D4D4D4] bg-white ${PANEL_PADDING} shadow-[0px_15px_34px_0px_rgba(0,0,0,0.10)]`}
              >
                {panelBody(closeDesktop)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          ref={handleRef}
          type="button"
          data-messages-tab
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
          onClick={() => setPinned((p) => !p)}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)] transition-colors ${
            open ? 'border-[#0A0A0A]/40' : 'border-[#D4D4D4]'
          }`}
        >
          <Icon icon="ph:envelope" width={18} height={18} className="text-[#737373]" aria-hidden="true" />
          {unreadCount > 0 ? (
            <motion.span
              key={pulseKey}
              animate={prefersReducedMotion ? undefined : { scale: [1, 1.35, 1] }}
              transition={{ duration: 0.36, ease: 'easeOut' }}
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#81133B] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          ) : (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#D4D4D4] ring-2 ring-white" />
          )}
        </button>
      </div>
    )
  }

  // A slim binder tab pinned to the viewport's right edge, stacked below the
  // Tutorial and Activity tabs by the dock in ClientLayout. Hover or click peeks
  // the feed panel out to the LEFT of the tab. The panel is absolutely
  // positioned so opening it never reflows (splits) the sibling tabs (#114).
  return (
    <div
      ref={drawerRef}
      className="pointer-events-auto relative flex items-center justify-end"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* New-message peek bubble (#181): slides out of the tab, pauses, drops back. */}
      <AnimatePresence>
        {peek && !open && (
          <motion.button
            key={peek.note.id}
            type="button"
            onClick={() => {
              setPeek(null)
              setPinned(true)
            }}
            initial={{ x: 18, opacity: 0, scale: 0.96 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 18, opacity: 0, scale: 0.96 }}
            transition={{ duration: DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
            className="absolute right-[calc(100%_+_10px)] top-1/2 flex max-w-[260px] -translate-y-1/2 items-center gap-3 rounded-2xl rounded-br-md border border-[#D4D4D4] bg-white py-2.5 pl-3 pr-3.5 text-left shadow-[0px_12px_28px_0px_rgba(0,0,0,0.12)]"
          >
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${ICON_TINT[peek.note.type]}`}
            >
              <Icon icon={ICON_FOR[peek.note.type]} width={13} height={13} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="block truncate text-[12px] font-semibold leading-[16px] text-[#0A0A0A]">
                {peek.note.title}
              </span>
              {peek.important && (
                <span className="block text-[10px] font-medium leading-[14px] text-[#81133B]">
                  {peek.note.type === 'signature' ? 'Signature required' : 'Needs your attention'}
                </span>
              )}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
            className="absolute bottom-0 right-[calc(100%_+_12px)] overflow-hidden"
          >
            <div
              id={panelId}
              style={{ maxHeight: maxPanelHeight }}
              className={`flex max-h-[calc(100dvh-1.5rem)] w-[300px] flex-col rounded-[16px] border border-[#D4D4D4] bg-white ${PANEL_PADDING} shadow-[0px_15px_34px_0px_rgba(0,0,0,0.10)]`}
            >
              {panelBody(closeDesktop)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={handleRef}
        type="button"
        data-messages-tab
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
        onClick={() => setPinned((p) => !p)}
        className={`relative flex h-[120px] w-9 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-l-[12px] border border-r-0 bg-white transition-colors ${
          open ? 'border-[#0A0A0A]/40' : 'border-[#D4D4D4] hover:border-[#0A0A0A]/[0.3]'
        }`}
      >
        {unreadCount > 0 ? (
          <motion.span
            key={pulseKey}
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.35, 1] }}
            transition={{ duration: 0.36, ease: 'easeOut' }}
            className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#81133B] px-1 text-[9px] font-bold leading-none text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-[#D4D4D4]" />
        )}
        <Icon icon="ph:envelope" width={15} height={15} className="text-[#737373]" aria-hidden="true" />
        <span
          className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#737373]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Messages
        </span>
      </button>
    </div>
  )
}

export default NotificationsDrawer
