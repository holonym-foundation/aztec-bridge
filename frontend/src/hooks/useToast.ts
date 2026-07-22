import { toast, ToastOptions, collapseToast, type ToastTransitionProps } from 'react-toastify'
import React from 'react'
import { UseQueryOptions, UseMutationOptions, useQuery, useMutation, QueryFunction } from '@tanstack/react-query'
import PrivacyModeToast from '@/components/toast/PrivacyModeToast'
import DefaultToast from '@/components/toast/DFToast'
import InfoToast from '@/components/toast/InfoToast'
import LoadingToast from '@/components/toast/LoadingToast'
import SuccessToast from '@/components/toast/SuccessToast'
import WarningToast from '@/components/toast/WarningToast'
import ErrorToast from '@/components/toast/ErrorToast'
import { pushNotification, type NotificationType } from '@/stores/useNotificationsStore'

/**
 * Toast System with Loading Spinner Support and Duplicate Error Prevention
 *
 * Features:
 * - Prevents duplicate error messages from being shown simultaneously
 * - Automatic cleanup of error message tracking when toasts are dismissed
 * - Loading spinner support for async operations
 *
 * @example Basic Usage
 * const notify = useToast()
 * notify('success', 'Operation completed!')
 * notify('error', { message: 'Failed!', heading: 'Error' })
 *
 * @example Promise Toasts
 * notify.promise(somePromise, {
 *   pending: 'Loading...',
 *   success: 'Done!',
 *   error: 'Failed!'
 * }, { animatePromise: true })
 *
 * @example React Query
 * useToastQuery({ queryFn, toastMessages: { pending: '...', success: '...', error: '...' } })
 * useToastMutation({ mutationFn, toastMessages: { pending: '...', success: '...', error: '...' } })
 *
 * @example Clear Error Messages
 * notify.clearErrorMessages() // Clears the duplicate error tracking
 */

// ============================================================================
// TYPES
// ============================================================================

type ToastType = 'default' | 'success' | 'info' | 'warn' | 'error' | 'privacy-mode'

// widen back to ReactNode so callers can pass JSX (clickable links,
// styled spans). String messages still work; the toast renderers accept both.
type ToastMessageInput = string | { message: string | React.ReactNode; heading?: string }

// `feed` opts a toast OUT of being mirrored into the Messages feed. Default is
// to mirror — the feed is the single source of truth, so every meaningful toast
// lands there. Set `feed: false` only when a richer, semantic pushNotification
// is issued for the same event at the call site (so the event isn't recorded
// twice).
type FeedOption = { feed?: boolean }

type ToastOptionsWithFeed = ToastOptions & FeedOption

type CustomToastOptions = ToastOptions & {
  animatePromise?: boolean
} & FeedOption

type ToastMessageObject = {
  message: string | React.ReactNode
  heading?: string
  options?: ToastOptions
}

type ToastMessages = {
  pending?: string | ToastMessageObject
  success?: string | ToastMessageObject
  error?: string | ToastMessageObject
}

// ============================================================================
// CONSTANTS
// ============================================================================

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// react-toastify types collapseToast's duration as an internal enum; it accepts
// any ms value at runtime. Wrap once so call sites can pass plain numbers.
const collapse = (node: HTMLElement, done: () => void, ms: number) =>
  (collapseToast as (n: HTMLElement, d: () => void, duration?: number) => void)(node, done, ms)

// Toast exit: react-toastify's slide-out. New messages are surfaced from the
// Messages tab itself (NotificationsDrawer's peek bubble, driven by the feed
// store), so the toast no longer flies into the tab — it just slides away while
// the tab peeks the message out and pulses its unread badge.
const slideExit = (node: HTMLElement, done: () => void, position: string) => {
  const exitClasses = `Toastify--animate Toastify__slide-exit--${position}`.split(' ')
  const onEnd = () => {
    node.removeEventListener('animationend', onEnd)
    collapse(node, done, 300)
  }
  node.classList.add(...exitClasses)
  node.addEventListener('animationend', onEnd)
}

// Custom react-toastify transition. Entrance is unchanged from the previous
// `Slide` (same position-appended enter classes, whose CSS the library injects).
// The EXIT slides out; reduced-motion / drag-dismiss just close with no travel.
const GenieToastTransition = ({
  children,
  position,
  preventExitTransition,
  done,
  nodeRef,
  isIn,
  playToast,
}: ToastTransitionProps) => {
  React.useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const enterClasses = `Toastify--animate Toastify__slide-enter--${position}`.split(' ')
    node.classList.add(...enterClasses)
    const onEnd = (e: AnimationEvent) => {
      if (e.target !== node) return
      playToast()
      node.removeEventListener('animationend', onEnd)
      node.removeEventListener('animationcancel', onEnd)
      node.classList.remove(...enterClasses)
    }
    node.addEventListener('animationend', onEnd)
    node.addEventListener('animationcancel', onEnd)
    // Runs once on mount, mirroring react-toastify's cssTransition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (isIn) return
    const node = nodeRef.current
    if (!node) {
      done()
      return
    }
    // No travel for drag-dismiss or reduced-motion: the toast just closes and
    // the Messages badge increments on its own.
    if (preventExitTransition || prefersReducedMotion()) {
      done()
      return
    }
    slideExit(node, done, position)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIn])

  return React.createElement(React.Fragment, null, children)
}

const DEFAULT_TOAST_OPTIONS: ToastOptions = {
  position: 'top-right',
  // Short by default — transient success/info/default toasts genie into Messages
  // promptly (the message persists there anyway). Warnings run longer and errors
  // are non-auto (see the per-type overrides in createToast). Persistent banners
  // override this with autoClose: false at the call site.
  autoClose: 4000,
  pauseOnHover: true,
  pauseOnFocusLoss: true,
  closeButton: false,
  closeOnClick: true,
  icon: false,
  transition: GenieToastTransition,
}

const LOADING_TOAST_OPTIONS: Partial<ToastOptions> = {
  closeButton: false,
  closeOnClick: false,
  autoClose: false,
}

// Track active error messages to prevent duplicates
const activeErrorMessages = new Set<string>()

// ============================================================================
// TOAST COMPONENT MAPPING
// ============================================================================

const TOAST_COMPONENTS = {
  default: DefaultToast,
  success: SuccessToast,
  info: InfoToast,
  warn: WarningToast,
  error: ErrorToast,
  'privacy-mode': PrivacyModeToast,
} as const

// ============================================================================
// FEED MIRRORING — single source of truth
// ============================================================================

// Toast severities that don't represent a "message" worth keeping: the default
// (styleless) toast and the privacy-mode UI toggle. Everything else is mirrored.
const FEED_TYPE_FOR: Partial<Record<ToastType, NotificationType>> = {
  success: 'success',
  error: 'error',
  warn: 'warning',
  info: 'info',
}

/**
 * Mirror a toast into the persistent Messages feed so nothing shown transiently
 * is ever lost. `feed === false` opts out (used where the call site already
 * pushes a richer, semantic notification for the same event). A toast that
 * carries a `toastId` is mirrored under that id as a stable key, so a flow's
 * repeating status toasts (which all reuse one id) collapse into a single,
 * live-updating feed row instead of one row per emit.
 */
const mirrorToFeed = (
  type: ToastType,
  message: string | React.ReactNode,
  heading: string | undefined,
  options: ToastOptionsWithFeed,
): boolean => {
  if (options.feed === false) return false
  const feedType = FEED_TYPE_FOR[type]
  if (!feedType) return false

  const stringMessage = typeof message === 'string' ? message : undefined
  // With a heading, title = heading and body = the message. Without one, the
  // message itself is the title. A JSX-only message with no heading can't be
  // represented as feed text, so skip it (the toast still shows).
  const title = heading ?? stringMessage
  const body = heading ? stringMessage : undefined
  if (!title || !title.trim()) return false

  const key =
    typeof options.toastId === 'string'
      ? options.toastId
      : typeof options.toastId === 'number'
        ? String(options.toastId)
        : undefined

  pushNotification({ type: feedType, title, message: body, key })
  return true
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalizes message input to object format
 */
const normalizeMessage = (input: ToastMessageInput) => (typeof input === 'string' ? { message: input } : input)

/**
 * Extracts options from toast message object
 */
const extractOptions = (messageObj: string | ToastMessageObject) =>
  typeof messageObj === 'object' ? messageObj.options || {} : {}

/**
 * Extracts a human-readable error message from axios errors or generic errors.
 * Order: BridgeApiError.friendlyMessage (status-mapped + JSON-aware) →
 * axios `response.data.reason|error|message` → standard `err.message`.
 *
 * Never returns `err.body` raw — it can be a 5KB HTML error page.
 */
const extractErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null
  const err = error as any
  // BridgeApiError: prefer the curated friendlyMessage
  if (typeof err?.friendlyMessage === 'string' && err.friendlyMessage.length > 0) {
    return err.friendlyMessage
  }
  // Axios error with response body
  const responseData = err?.response?.data
  if (responseData) {
    if (typeof responseData === 'string' && responseData.length <= 200 && !responseData.trim().startsWith('<')) {
      return responseData
    }
    if (responseData.reason) return responseData.reason
    if (responseData.error) return responseData.error
    if (responseData.message) return responseData.message
  }
  // Standard Error
  if (err?.message) return err.message
  return null
}

/**
 * Per-severity timing defaults, layered under caller options. Errors stay
 * on-screen until dismissed (non-auto); warnings run longer than the short
 * default so users don't miss them; everything else takes the default.
 */
const typeOverrides = (type: ToastType): ToastOptions =>
  type === 'error' ? { autoClose: false, closeOnClick: false } : type === 'warn' ? { autoClose: 8000 } : {}

/**
 * Creates merged options with proper precedence
 */
const createMergedOptions = (baseOptions: ToastOptions, customOptions: ToastOptions = {}) => ({
  ...DEFAULT_TOAST_OPTIONS,
  ...baseOptions,
  ...customOptions,
})

/**
 * Creates a toast with the specified component and options
 */
const createToast = (
  type: ToastType,
  message: string | React.ReactNode,
  heading?: string,
  options: ToastOptionsWithFeed = {},
) => {
  // #202/#207. Record the event in the Messages feed first. When it lands
  // there, the feed row plus the peek-from-tab bubble ARE the surfacing, so the
  // corner toast is redundant and is suppressed. The one exception is a banner
  // the caller explicitly pins open (autoClose:false), a persistent interactive
  // surface such as a "keep this page open" warning, which is not a
  // fire-and-forget notification and still renders in the corner. Everything
  // else (signature/claim/deposit/withdraw/success/info/error) surfaces via the
  // peek bubble plus feed only.
  const mirrored = mirrorToFeed(type, message, heading, options)
  if (mirrored && options.autoClose !== false) return null

  // For error toasts, check if this exact message is already active
  // Use only the heading for de-dupe when message is non-string (JSX),
  // since JSX nodes can't be reliably stringified for keying.
  if (type === 'error') {
    const messageKey =
      typeof message === 'string' ? `${message}${heading ? `|${heading}` : ''}` : `__jsx__${heading ?? ''}`

    if (activeErrorMessages.has(messageKey)) {
      // Message already exists, don't show duplicate
      return null
    }

    // Add to active messages
    activeErrorMessages.add(messageKey)

    // Set up cleanup when toast is dismissed
    const originalOnClose = options.onClose
    options.onClose = () => {
      activeErrorMessages.delete(messageKey)
      originalOnClose?.()
    }
  }

  const Component = TOAST_COMPONENTS[type]
  const { feed: _feed, ...toastableOptions } = options
  const toastOptions = createMergedOptions({}, { ...typeOverrides(type), ...toastableOptions })

  const finalOptions = {
    className: `${type}-toast`,
    ...(type === 'privacy-mode' ? { toastId: 'privacy-mode-toastId' } : {}),
    ...toastOptions,
  }

  // If a toastId is specified and that toast is already active, update it in-place
  // so the message refreshes without creating a new toast or being silently ignored.
  if (finalOptions.toastId && toast.isActive(finalOptions.toastId)) {
    toast.update(finalOptions.toastId, {
      // `message` widened to ReactNode for ErrorToast; the other toast
      render:
        // components type it as string but React renders ReactNode fine at runtime.
        React.createElement(Component as any, { heading, message }),
      ...finalOptions,
    })
    return finalOptions.toastId
  }

  return toast(
    // `message` widened to ReactNode for ErrorToast; the other toast
    // components type it as string but React renders ReactNode fine at runtime.
    React.createElement(Component as any, { heading, message }),
    finalOptions,
  )
}

/**
 * Creates a loading toast
 */
const createLoadingToast = (message: string | React.ReactNode, heading?: string, options: ToastOptions = {}) => {
  const mergedOptions = createMergedOptions({}, options)

  return toast(React.createElement(LoadingToast as any, { heading, message }), {
    ...mergedOptions,
    className: 'loading-toast',
    ...LOADING_TOAST_OPTIONS,
  })
}

/**
 * Updates a toast to success or error state
 */
const updateToastState = (
  toastId: string | number,
  type: 'success' | 'error',
  message: string | React.ReactNode,
  heading?: string,
  options: ToastOptionsWithFeed = {},
) => {
  // #202/#207. Mirror the resolved state into the feed. When it lands there it
  // surfaces via the peek bubble plus feed, so retire the transient loading
  // toast rather than morphing it into a redundant corner success/error. A
  // caller that explicitly pinned the resolved state open (autoClose:false)
  // keeps its corner banner.
  const mirrored = mirrorToFeed(type, message, heading, options)
  if (mirrored && options.autoClose !== false) {
    toast.dismiss(toastId)
    return
  }

  // For error toasts, check if this exact message is already active.
  // Match createToast's keying so JSX messages don't trigger string interpolation.
  if (type === 'error') {
    const messageKey =
      typeof message === 'string' ? `${message}${heading ? `|${heading}` : ''}` : `__jsx__${heading ?? ''}`

    if (activeErrorMessages.has(messageKey)) {
      // Message already exists, dismiss the loading toast instead of updating to error
      toast.dismiss(toastId)
      return
    }

    // Add to active messages
    activeErrorMessages.add(messageKey)

    // Set up cleanup when toast is dismissed
    const originalOnClose = options.onClose
    options.onClose = () => {
      activeErrorMessages.delete(messageKey)
      originalOnClose?.()
    }
  }

  const Component = TOAST_COMPONENTS[type]
  const { feed: _feed, ...toastableOptions } = options
  const mergedOptions = createMergedOptions({}, { ...typeOverrides(type), ...toastableOptions })

  toast.update(toastId, {
    // `message` widened to ReactNode for ErrorToast; the other toast
    render:
      // components type it as string but React renders ReactNode fine at runtime.
      React.createElement(Component as any, { heading, message }),
    className: `${type}-toast from-loading`,
    type,
    isLoading: false,
    ...mergedOptions,
  })
}

/**
 * Handles promise toast logic
 */
const handlePromiseToast = <T>(
  promise: Promise<T>,
  messages: {
    pending: string | { message: string; heading?: string }
    success: string | { message: string; heading?: string }
    error: string | { message: string; heading?: string }
  },
  options: CustomToastOptions = {},
): Promise<T> => {
  const { animatePromise, ...toastOptions } = options

  // Create loading toast
  const pendingMsg = normalizeMessage(messages.pending)
  const pendingOptions = extractOptions(messages.pending)
  const toastId = createLoadingToast(pendingMsg.message, pendingMsg.heading, pendingOptions)

  return promise
    .then((data) => {
      const successMsg = normalizeMessage(messages.success)
      const successOptions = extractOptions(messages.success)

      if (animatePromise) {
        toast.dismiss(toastId)
        createToast('success', successMsg.message, successMsg.heading, {
          ...toastOptions,
          ...successOptions,
          className: 'success-toast from-loading',
        })
      } else {
        updateToastState(toastId, 'success', successMsg.message, successMsg.heading, {
          ...toastOptions,
          ...successOptions,
        })
      }
      return data
    })
    .catch((error) => {
      const errorMsg = normalizeMessage(messages.error)
      const errorOptions = extractOptions(messages.error)

      if (animatePromise) {
        toast.dismiss(toastId)
        createToast('error', errorMsg.message, errorMsg.heading, {
          ...toastOptions,
          ...errorOptions,
          className: 'error-toast from-loading',
        })
      } else {
        updateToastState(toastId, 'error', errorMsg.message, errorMsg.heading, {
          ...toastOptions,
          ...errorOptions,
        })
      }
      throw error
    })
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export const useToast = () => {
  const showToast = (type: ToastType, input: ToastMessageInput, options?: CustomToastOptions) => {
    const { message, heading } = normalizeMessage(input)
    createToast(type, message, heading, options)
  }

  showToast.promise = handlePromiseToast
  showToast.dismiss = (toastId?: string | number) => toast.dismiss(toastId)
  showToast.dismissAll = () => toast.dismiss()
  showToast.clearErrorMessages = () => {
    activeErrorMessages.clear()
  }

  return showToast
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useToastQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends Array<unknown> = unknown[],
>(
  options: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryFn'> & {
    queryFn: QueryFunction<TQueryFnData, TQueryKey>
    toastMessages?: ToastMessages
    silentRefresh?: boolean
  },
) {
  const notify = useToast()
  const { toastMessages, queryFn, silentRefresh = true, ...queryOptions } = options

  return useQuery({
    ...queryOptions,
    queryFn: async (context) => {
      let toastId: string | number | undefined

      try {
        const result = queryFn(context)
        const resultPromise = Promise.resolve(result)

        // Show loading toast if messages are provided
        if (toastMessages?.pending) {
          const isInitialLoad = !context.signal
          if (!silentRefresh || isInitialLoad) {
            const pendingMsg = normalizeMessage(toastMessages.pending)
            const pendingOptions = extractOptions(toastMessages.pending)
            toastId = createLoadingToast(pendingMsg.message, pendingMsg.heading, pendingOptions)
          }
        }

        const data = await resultPromise

        // Show success toast
        if (toastId && toastMessages?.success) {
          const successMsg = normalizeMessage(toastMessages.success)
          const successOptions = extractOptions(toastMessages.success)
          updateToastState(toastId, 'success', successMsg.message, successMsg.heading, successOptions)
        }

        return data
      } catch (error) {
        // Show error toast
        if (toastId && toastMessages?.error) {
          const errorMsg = normalizeMessage(toastMessages.error)
          const errorOptions = extractOptions(toastMessages.error)
          updateToastState(toastId, 'error', errorMsg.message, errorMsg.heading, errorOptions)
        } else if (toastMessages?.error && !toastId) {
          // Fallback for when there's no loading toast
          const errorMsg = normalizeMessage(toastMessages.error)
          const errorOptions = extractOptions(toastMessages.error)
          notify('error', errorMsg, errorOptions)
        }
        throw error
      }
    },
  })
}

export function useToastMutation<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
  options: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> & {
    mutationFn: (variables: TVariables) => Promise<TData>
    toastMessages?: ToastMessages
  },
) {
  const notify = useToast()
  const { toastMessages, mutationFn, ...mutationOptions } = options
  const toastIdRef = React.useRef<string | number | undefined>(undefined)

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables) => {
      try {
        // Show loading toast
        if (toastMessages?.pending) {
          const pendingMsg = normalizeMessage(toastMessages.pending)
          const pendingOptions = extractOptions(toastMessages.pending)
          toastIdRef.current = createLoadingToast(pendingMsg.message, pendingMsg.heading, pendingOptions)
        }

        return await mutationFn(variables)
      } catch (error) {
        // Handle error in mutationFn — include backend error message if available
        if (toastIdRef.current && toastMessages?.error) {
          const errorMsg = normalizeMessage(toastMessages.error)
          const errorOptions = extractOptions(toastMessages.error)
          const backendMessage = extractErrorMessage(error)
          const displayMessage = backendMessage ? `${errorMsg.message}: ${backendMessage}` : errorMsg.message
          updateToastState(toastIdRef.current, 'error', displayMessage, errorMsg.heading, errorOptions)
          toastIdRef.current = undefined
        }
        throw error
      }
    },
    onSuccess: (data, variables, onMutateResult, fnContext) => {
      // Handle success
      if (toastIdRef.current && toastMessages?.success) {
        const successMsg = normalizeMessage(toastMessages.success)
        const successOptions = extractOptions(toastMessages.success)
        updateToastState(toastIdRef.current, 'success', successMsg.message, successMsg.heading, successOptions)
        toastIdRef.current = undefined
      } else if (toastMessages?.success && !toastIdRef.current) {
        // Fallback
        const successMsg = normalizeMessage(toastMessages.success)
        const successOptions = extractOptions(toastMessages.success)
        notify('success', successMsg, successOptions)
      }

      mutationOptions.onSuccess?.(data, variables, onMutateResult, fnContext)
    },
    onError: (error, variables, onMutateResult, fnContext) => {
      // Handle error fallback — include backend error message if available
      if (toastMessages?.error && !toastIdRef.current) {
        const errorMsg = normalizeMessage(toastMessages.error)
        const errorOptions = extractOptions(toastMessages.error)
        const backendMessage = extractErrorMessage(error)
        const displayMessage = backendMessage ? `${errorMsg.message}: ${backendMessage}` : errorMsg.message
        notify('error', { ...errorMsg, message: displayMessage }, errorOptions)
      }

      mutationOptions.onError?.(error, variables, onMutateResult, fnContext)
    },
  })
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

export const showToast = (type: ToastType, input: ToastMessageInput, options?: ToastOptionsWithFeed) => {
  const { message, heading } = normalizeMessage(input)
  createToast(type, message, heading, options)
}

showToast.promise = handlePromiseToast
showToast.dismiss = (toastId?: string | number) => toast.dismiss(toastId)
showToast.dismissAll = () => toast.dismiss()
showToast.clearErrorMessages = () => {
  activeErrorMessages.clear()
}
