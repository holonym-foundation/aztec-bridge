'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { useNotificationsStore, type AppNotification, type NotificationType } from '@/stores/useNotificationsStore'
import { GENIE_LANDED_EVENT } from '@/hooks/useToast'

// Motion values mirrored from the human-tech design system (docs/tokens.css):
// --dur-enter / --ease-slide for the panel that slides out from the tab.
const DS_DUR_ENTER = 0.32
const DS_EASE_SLIDE: [number, number, number, number] = [0.32, 0.72, 0, 1]

const PANEL_WIDTH = 300
// Fixed page size — the panel paginates rather than scrolls, matching the app's
// no-scroll direction.
const PAGE_SIZE = 4

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

const NotificationsDrawer: React.FC = () => {
  const notifications = useNotificationsStore((s) => s.notifications)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const dismiss = useNotificationsStore((s) => s.dismiss)
  const dismissAll = useNotificationsStore((s) => s.dismissAll)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)

  const panelId = useId()
  const prefersReducedMotion = useReducedMotion()

  // Hover previews the panel; a click pins it open. On touch (no hover) the tap
  // toggles `pinned`, so the same handle works on every size.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [page, setPage] = useState(0)
  const open = hovered || pinned
  const drawerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)

  // Genie-into-tab: the actual toast flies into this tab as it auto-closes (see
  // useToast's GenieToastTransition). The moment it lands, the toast dispatches
  // GENIE_LANDED_EVENT and we pulse the unread badge — so the flight and the
  // badge read as one motion. Motion is fully gated on prefers-reduced-motion:
  // reduced-motion users get no fly and no pulse, just the incremented badge.
  const [pulseKey, setPulseKey] = useState(0)

  useEffect(() => {
    const onLanded = () => setPulseKey((k) => k + 1)
    window.addEventListener(GENIE_LANDED_EVENT, onLanded)
    return () => window.removeEventListener(GENIE_LANDED_EVENT, onLanded)
  }, [])

  const closeDesktop = () => {
    setPinned(false)
    setHovered(false)
    handleRef.current?.focus()
  }

  // Opening the feed clears the unread badge — the user is now looking at it.
  useEffect(() => {
    if (open) markAllRead()
  }, [open, markAllRead])

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

  const renderItem = (n: AppNotification) => (
    <li key={n.id} className="flex gap-2.5 border-b border-[#F0F0F0] py-2.5 last:border-b-0 last:pb-0">
      <span
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${ICON_TINT[n.type]}`}
      >
        <Icon icon={ICON_FOR[n.type]} width={13} height={13} />
      </span>
      <div className="min-w-0 flex-1">
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
          <p className="mt-0.5 text-[11px] leading-[16px] text-[#737373] break-words [overflow-wrap:anywhere]">
            {n.message}
          </p>
        )}
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.3px] text-[#B7B7B7]">
          {formatDistanceToNowStrict(new Date(n.timestamp), { addSuffix: true })}
        </p>
      </div>
    </li>
  )

  const panelBody = (onClose?: () => void) => (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
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
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F0F0] text-[#B7B7B7]">
            <Icon icon="ph:bell-simple" width={18} height={18} />
          </span>
          <p className="text-[12px] font-medium text-[#737373]">You're all caught up</p>
          <p className="text-[11px] text-[#B7B7B7]">Signing, claims and bridge updates will show up here.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col">{pageItems.map(renderItem)}</ul>
          {notifications.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-[#F0F0F0] pt-3">
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
                {rangeStart}–{rangeEnd} of {notifications.length}
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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
            className="absolute right-[calc(100%_+_12px)] top-1/2 -translate-y-1/2 overflow-hidden"
          >
            <div
              id={panelId}
              className="w-[300px] rounded-[16px] border border-[#D4D4D4] bg-white p-4 shadow-[0px_15px_34px_0px_rgba(0,0,0,0.10)]"
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
