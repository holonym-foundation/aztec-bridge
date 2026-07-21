'use client'

import { create } from 'zustand'

// Persistent, in-app feed of the events that used to live only in transient
// toasts. Toasts stay for momentary confirmations; anything the user may want
// to look back on (a signature request, a claim/withdrawal/deposit outcome, an
// error) also lands here so it survives the toast's autoClose. The feed is the
// single source of truth — every meaningful toast is mirrored here (see
// useToast.ts), so nothing shown transiently is ever lost.
export type NotificationType =
  | 'signature'
  | 'claim'
  | 'withdrawal'
  | 'deposit'
  | 'error'
  | 'info'
  | 'success'
  | 'warning'

export interface AppNotification {
  id: string
  // Optional stable identity. When present, a later push with the same key
  // updates this entry in place instead of appending a new row — this is how a
  // long-running flow (a bridge's repeating sync/claim pings, all sharing one
  // toastId) collapses to a single, live-updating feed row instead of flooding
  // the feed with a new entry every poll.
  key?: string
  type: NotificationType
  title: string
  message?: string
  timestamp: number
  read: boolean
}

// Signal the drawer uses to fire the "genie into Messages" animation exactly
// once per genuinely-new entry (never on an in-place key update, so progress
// pings don't re-trigger it every poll).
export interface GenieSignal {
  id: string
  type: NotificationType
}

// Keep the feed bounded — old entries fall off the end so the store never grows
// without limit across a long session.
const MAX_NOTIFICATIONS = 50

// Collapse an immediate repeat of the same un-keyed event (same type/title/message
// within a short window). Re-renders and retrying flows can fire the same push
// twice; the feed should record the event once, not stutter.
const DEDUPE_WINDOW_MS = 4000

interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  lastGenie: GenieSignal | null
  pushNotification: (input: { type: NotificationType; title: string; message?: string; key?: string }) => void
  dismiss: (id: string) => void
  dismissAll: () => void
  markAllRead: () => void
}

const unread = (list: AppNotification[]) => list.filter((n) => !n.read).length

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  lastGenie: null,

  pushNotification: ({ type, title, message, key }) =>
    set((state) => {
      // Keyed upsert — refresh the existing row in place (new text/timestamp,
      // bumped to the top) and preserve its read state so a progress row the
      // user has already seen doesn't keep re-badging on every poll. No genie.
      if (key) {
        const idx = state.notifications.findIndex((n) => n.key === key)
        if (idx !== -1) {
          const existing = state.notifications[idx]
          const updated: AppNotification = {
            ...existing,
            type,
            title,
            message,
            timestamp: Date.now(),
          }
          const rest = state.notifications.filter((_, i) => i !== idx)
          const notifications = [updated, ...rest].slice(0, MAX_NOTIFICATIONS)
          return { notifications, unreadCount: unread(notifications) }
        }
      }

      const latest = state.notifications[0]
      if (
        latest &&
        latest.type === type &&
        latest.title === title &&
        latest.message === message &&
        Date.now() - latest.timestamp < DEDUPE_WINDOW_MS
      ) {
        return state
      }

      const next: AppNotification = {
        id: makeId(),
        key,
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
      }
      const notifications = [next, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
      return { notifications, unreadCount: unread(notifications), lastGenie: { id: next.id, type } }
    }),

  dismiss: (id) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id)
      return { notifications, unreadCount: unread(notifications) }
    }),

  dismissAll: () => set({ notifications: [], unreadCount: 0 }),

  markAllRead: () =>
    set((state) => {
      if (state.unreadCount === 0) return state
      return {
        notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
        unreadCount: 0,
      }
    }),
}))

// Convenience for non-React call sites (zustand stores, event callbacks) that
// shouldn't subscribe — mirrors how showToast is used across the app.
export const pushNotification = (input: {
  type: NotificationType
  title: string
  message?: string
  key?: string
}) => useNotificationsStore.getState().pushNotification(input)
