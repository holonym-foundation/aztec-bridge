import {
  EMBED_PARAMS,
  envelope,
  isEmbedEnvelope,
  type EmbedDefaults,
  type EmbedEventType,
  type EmbedInboundMessage,
  type EmbedOutboundMessage,
} from './protocol'

export * from './protocol'

const DEFAULT_APP_URL = 'https://shield.human.tech'
// Comfortably above the embedded shell's 560px min-height (see ClientLayout),
// so the bridge card and its primary CTA both fit without clipping.
const DEFAULT_INLINE_HEIGHT = 640

// Backstop for the `busy` lock. The app emits a terminal event for every failure
// it can see, but a crashed frame or a closed laptop emits nothing, and a modal
// that can never be dismissed is worse than one dismissed early. Sized per chain:
// an L1 deposit settles in minutes, an L2 withdrawal waits on L1 proving (~40min).
const BUSY_TIMEOUT_MS: Record<'l1' | 'l2', number> = {
  l1: 15 * 60_000,
  l2: 90 * 60_000,
}

export type ShieldEmbedOptions = {
  /** Partner id issued by human.tech, passed through to Shield. */
  partnerId?: string
  /** 'modal' overlays the host page; 'inline' mounts into `target`. */
  mode?: 'modal' | 'inline'
  /** Required for inline mode: element or CSS selector to mount into. */
  target?: Element | string
  /** Height in px for inline mode. Modal mode always fills the overlay. */
  height?: number
  /** Starting values for the bridge form. */
  defaults?: EmbedDefaults
  /** Override the Shield origin. Only useful for staging/local development. */
  appUrl?: string
  /** Called for every event the framed app emits. */
  onEvent?: (event: EmbedOutboundMessage) => void
}

type Listener = (event: EmbedOutboundMessage) => void

export type ShieldEmbed = {
  open(): void
  close(): void
  /** Drive the framed app to an in-app route, e.g. '/activity'. */
  navigate(route: string): void
  on(type: EmbedEventType | '*', listener: Listener): () => void
  destroy(): void
  readonly isOpen: boolean
}

function resolveTarget(target: Element | string | undefined): Element | null {
  if (!target) return null
  return typeof target === 'string' ? document.querySelector(target) : target
}

function buildSrc(options: ShieldEmbedOptions): string {
  const url = new URL(options.appUrl ?? DEFAULT_APP_URL)
  url.searchParams.set(EMBED_PARAMS.enabled, '1')
  url.searchParams.set(EMBED_PARAMS.parentOrigin, window.location.origin)
  if (options.partnerId) url.searchParams.set(EMBED_PARAMS.partner, options.partnerId)
  if (options.defaults?.token) url.searchParams.set(EMBED_PARAMS.token, options.defaults.token)
  if (options.defaults?.amount) url.searchParams.set(EMBED_PARAMS.amount, options.defaults.amount)
  return url.toString()
}

export function create(options: ShieldEmbedOptions = {}): ShieldEmbed {
  const mode = options.mode ?? 'modal'
  const appOrigin = new URL(options.appUrl ?? DEFAULT_APP_URL).origin
  const listeners = new Map<string, Set<Listener>>()

  let iframe: HTMLIFrameElement | null = null
  let overlay: HTMLDivElement | null = null
  let open = false
  let destroyed = false
  let lastFocused: Element | null = null
  let previousBodyOverflow = ''
  // True between a submitted transaction and its terminal event. Shield tells
  // the user to keep the page open while a bridge settles, so a stray Esc or
  // backdrop click must not tear the frame down underneath them.
  let busy = false
  let busyTimer: ReturnType<typeof setTimeout> | null = null
  let pendingMount: (() => void) | null = null

  function setBusy(value: boolean, chain?: 'l1' | 'l2'): void {
    busy = value
    if (busyTimer) clearTimeout(busyTimer)
    busyTimer = null
    if (value) busyTimer = setTimeout(() => (busy = false), BUSY_TIMEOUT_MS[chain ?? 'l2'])
  }

  function emit(event: EmbedOutboundMessage): void {
    options.onEvent?.(event)
    for (const listener of listeners.get(event.type) ?? []) listener(event)
    for (const listener of listeners.get('*') ?? []) listener(event)
  }

  function post(message: EmbedInboundMessage): void {
    iframe?.contentWindow?.postMessage(envelope(message), appOrigin)
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== appOrigin) return
    if (!iframe || event.source !== iframe.contentWindow) return
    if (!isEmbedEnvelope(event.data)) return

    const message = event.data as EmbedOutboundMessage
    if (message.type === 'tx:submitted') setBusy(true, message.chain)
    if (message.type === 'bridge:success' || message.type === 'error') setBusy(false)
    // A `close` from the frame is a dismissal REQUEST (the user pressed Escape
    // inside it), so it goes through the same busy guard as a backdrop click —
    // not straight to close(), which would tear down a settling bridge.
    if (message.type === 'close' && mode === 'modal') {
      dismiss()
      return
    }
    emit(message)
  }

  // Casual dismissal only — a host calling close() explicitly is still honoured.
  function dismiss(): void {
    if (busy) return
    close()
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open && mode === 'modal') dismiss()
  }

  function buildIframe(): HTMLIFrameElement {
    const el = document.createElement('iframe')
    el.src = buildSrc(options)
    el.title = 'Shield — private bridge'
    // No `sandbox`: Shield nests the WaaP wallet iframe, whose social sign-in
    // opens popups. Sandboxing would need allow-popups plus
    // allow-popups-to-escape-sandbox and allow-same-origin, which together add
    // no real restriction over the same-origin app while breaking the flows
    // that do work. `allow` is the meaningful control here — these features are
    // delegated down to the wallet iframes and cannot be re-granted from inside.
    el.allow = 'storage-access; publickey-credentials-get; clipboard-write'
    el.style.border = '0'
    el.style.width = '100%'
    el.style.display = 'block'
    el.style.colorScheme = 'normal'
    return el
  }

  // The modal's content is a cross-origin iframe, so a conventional focus trap —
  // enumerate the focusable descendants and wrap — cannot see inside it. Two
  // sentinels around the frame bounce focus back instead: Tab out of the frame
  // hits one, and it hands focus straight back.
  function buildFocusSentinel(): HTMLDivElement {
    const sentinel = document.createElement('div')
    sentinel.tabIndex = 0
    sentinel.setAttribute('aria-hidden', 'true')
    sentinel.style.position = 'fixed'
    sentinel.style.width = '1px'
    sentinel.style.height = '1px'
    sentinel.style.opacity = '0'
    sentinel.addEventListener('focus', () => iframe?.focus())
    return sentinel
  }

  function setHostInert(value: boolean): void {
    for (const child of Array.from(document.body.children)) {
      if (child === overlay) continue
      if (value) {
        if (child.hasAttribute('inert')) continue
        child.setAttribute('inert', '')
        child.setAttribute('data-shield-inert', '')
      } else if (child.hasAttribute('data-shield-inert')) {
        child.removeAttribute('inert')
        child.removeAttribute('data-shield-inert')
      }
    }
  }

  function mountModal(): void {
    overlay = document.createElement('div')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Shield')
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(24, 8, 18, 0.55)',
    } satisfies Partial<CSSStyleDeclaration>)
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) dismiss()
    })

    iframe = buildIframe()
    Object.assign(iframe.style, {
      width: 'min(480px, 100vw)',
      height: 'min(760px, 100dvh)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
    } satisfies Partial<CSSStyleDeclaration>)

    overlay.appendChild(buildFocusSentinel())
    overlay.appendChild(iframe)
    overlay.appendChild(buildFocusSentinel())
    document.body.appendChild(overlay)
    setHostInert(true)
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  function mountInline(): void {
    const host = resolveTarget(options.target)
    // Fail soft, not throw: in the script-tag build this runs during module
    // evaluation, so throwing here would take the `Shield` global down with it.
    if (!host) {
      console.error('[shield-embed] inline mode requires a `target` element or selector')
      open = false
      return
    }
    iframe = buildIframe()
    // Fixed height, not content-driven: the app's card is a uniform fixed height
    // on every route by design, so there is nothing to measure and no resize
    // handshake to run.
    iframe.style.height = `${options.height ?? DEFAULT_INLINE_HEIGHT}px`
    host.appendChild(iframe)
  }

  function close(): void {
    if (!open) return
    // Inline has nothing to close: the widget lives in the page's own flow, and
    // unmounting it would discard a bridge the user is part-way through. Hosts
    // that really want it gone call destroy().
    if (mode === 'inline') return
    open = false
    setBusy(false)
    setHostInert(false)
    document.body.style.overflow = previousBodyOverflow
    overlay?.remove()
    overlay = null
    iframe = null
    if (lastFocused instanceof HTMLElement) lastFocused.focus()
    // Emitted however the widget was dismissed — backdrop, Esc, or a host
    // calling close() — so a partner has one place to react to it.
    emit({ type: 'close' })
  }

  const api: ShieldEmbed = {
    get isOpen() {
      return open
    },
    open() {
      if (destroyed || open) return
      open = true
      if (mode === 'modal') {
        lastFocused = document.activeElement
        mountModal()
        iframe?.focus()
      } else if (!iframe) {
        // A `<script>` in `<head>` evaluates before the target exists, so an
        // inline mount waits for the document rather than missing it.
        if (document.readyState === 'loading') {
          pendingMount = () => {
            pendingMount = null
            if (!destroyed && !iframe) mountInline()
          }
          document.addEventListener('DOMContentLoaded', pendingMount, { once: true })
        } else {
          mountInline()
        }
      }
    },
    close,
    navigate(route: string) {
      post({ type: 'navigate', route })
    },
    on(type, listener) {
      const set = listeners.get(type) ?? new Set<Listener>()
      set.add(listener)
      listeners.set(type, set)
      return () => set.delete(listener)
    },
    destroy() {
      destroyed = true
      setBusy(false)
      close()
      if (pendingMount) document.removeEventListener('DOMContentLoaded', pendingMount)
      pendingMount = null
      iframe?.remove()
      iframe = null
      open = false
      listeners.clear()
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKeydown)
    },
  }

  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', onKeydown)

  // Inline mounts immediately — there is nothing to "open".
  if (mode === 'inline') api.open()

  return api
}

export default { create }
