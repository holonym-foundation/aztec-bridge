'use client'

import { create } from 'zustand'

// Persistent, in-app feed of the events that used to live only in transient
// toasts. Toasts stay for momentary confirmations; anything the user may want
// to look back on (a signature request, a claim/withdrawal/deposit outcome, an
// error) also lands here so it survives the toast's autoClose.
export type NotificationType = 'signature' | 'claim' | 'withdrawal' | 'deposit' | 'error' | 'info'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp: number
  read: boolean
}

// Keep the feed bounded — old entries fall off the end so the store never grows
// without limit across a long session.
const MAX_NOTIFICATIONS = 50

// Collapse an immediate repeat of the same event (same type/title/message within
// a short window). Re-renders and retrying flows can fire the same push twice;
// the feed should record the event once, not stutter.
const DEDUPE_WINDOW_MS = 4000

interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  pushNotification: (input: { type: NotificationType; title: string; message?: string }) => void
  dismiss: (id: string) => void
  dismissAll: () => void
  markAllRead: () => void
}

const unread = (list: AppNotification[]) => list.filter((n) => !n.read).length

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,

  pushNotification: ({ type, title, message }) =>
    set((state) => {
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
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
      }
      const notifications = [next, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
      return { notifications, unreadCount: unread(notifications) }
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
export const pushNotification = (input: { type: NotificationType; title: string; message?: string }) =>
  useNotificationsStore.getState().pushNotification(input)
