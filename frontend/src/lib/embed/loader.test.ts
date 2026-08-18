// @vitest-environment happy-dom
//
// The other half of this channel. It lives here rather than in packages/embed-sdk
// because this is the workspace that runs vitest, and because the busy/terminal
// contract only holds if both halves agree — the app emits the terminal events
// (see useL1Operations / useL2Operations) that release the lock asserted below.
import { create } from '@human.tech/shield-embed'
import { EMBED_CHANNEL, EMBED_PROTOCOL_VERSION, envelope, isEmbedEnvelope } from '@/lib/embed/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const APP = 'https://shield.human.tech'

function currentIframe(): HTMLIFrameElement | null {
  return document.querySelector('iframe')
}

function fromFrame(data: unknown, source: unknown = currentIframe()?.contentWindow): void {
  window.dispatchEvent(Object.assign(new Event('message'), { origin: APP, source, data }) as MessageEvent)
}

function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

beforeEach(() => {
  document.body.innerHTML = '<div id="host">host content</div><div id="mount"></div>'
})

describe('envelope validation', () => {
  it('requires the channel AND a matching protocol version', () => {
    expect(isEmbedEnvelope(envelope({ type: 'close' }))).toBe(true)
    expect(isEmbedEnvelope({ channel: EMBED_CHANNEL, type: 'close', protocol: EMBED_PROTOCOL_VERSION + 1 })).toBe(false)
    expect(isEmbedEnvelope({ channel: EMBED_CHANNEL, type: 'close' })).toBe(false)
    expect(isEmbedEnvelope({ channel: 'other', type: 'close', protocol: EMBED_PROTOCOL_VERSION })).toBe(false)
    expect(isEmbedEnvelope(null)).toBe(false)
  })
})

describe('modal chrome', () => {
  it('locks host scroll and inerts host content, restoring both on close', () => {
    const widget = create({ appUrl: APP })
    widget.open()

    const overlay = document.querySelector('[role="dialog"]')!
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.getElementById('host')!.hasAttribute('inert')).toBe(true)
    // focus sentinel, iframe, focus sentinel
    expect(overlay.children.length).toBe(3)
    expect((overlay.children[0] as HTMLElement).tabIndex).toBe(0)

    widget.close()
    expect(document.body.style.overflow).toBe('')
    expect(document.getElementById('host')!.hasAttribute('inert')).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    widget.destroy()
  })
})

describe('busy guard', () => {
  it('blocks casual dismissal while a bridge is in flight, and releases on error', () => {
    const seen: string[] = []
    const widget = create({ appUrl: APP, onEvent: (event) => seen.push(event.type) })
    widget.open()

    fromFrame(envelope({ type: 'tx:submitted', hash: '0x1', chain: 'l1' }))
    pressEscape()
    expect(widget.isOpen).toBe(true)

    fromFrame(envelope({ type: 'error', code: 'congestion', message: 'busy' }))
    expect(seen).toContain('error')
    pressEscape()
    expect(widget.isOpen).toBe(false)
    widget.destroy()
  })

  it('releases on bridge:success', () => {
    const widget = create({ appUrl: APP })
    widget.open()
    fromFrame(envelope({ type: 'tx:submitted', hash: '0x1', chain: 'l1' }))
    fromFrame(envelope({ type: 'bridge:success', operationId: 'op-1' }))
    pressEscape()
    expect(widget.isOpen).toBe(false)
    widget.destroy()
  })

  it('expires so a frame that never reports a terminal event cannot strand the user', () => {
    vi.useFakeTimers()
    const widget = create({ appUrl: APP })
    widget.open()
    fromFrame(envelope({ type: 'tx:submitted', hash: '0x1', chain: 'l1' }))

    vi.advanceTimersByTime(14 * 60_000)
    pressEscape()
    expect(widget.isOpen).toBe(true)

    vi.advanceTimersByTime(2 * 60_000)
    pressEscape()
    expect(widget.isOpen).toBe(false)
    widget.destroy()
    vi.useRealTimers()
  })

  it('gives an L2 withdrawal the longer budget it needs to finalize', () => {
    vi.useFakeTimers()
    const widget = create({ appUrl: APP })
    widget.open()
    fromFrame(envelope({ type: 'tx:submitted', hash: '0x1', chain: 'l2' }))

    vi.advanceTimersByTime(30 * 60_000)
    pressEscape()
    expect(widget.isOpen).toBe(true)
    widget.destroy()
    vi.useRealTimers()
  })
})

describe('message hygiene', () => {
  it('ignores traffic from the wrong origin or the wrong window', () => {
    const seen: string[] = []
    const widget = create({ appUrl: APP, onEvent: (event) => seen.push(event.type) })
    widget.open()
    const payload = envelope({ type: 'wallet:connected', address: '0xabc', chainId: 1 })

    window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://evil.example',
        source: currentIframe()?.contentWindow,
        data: payload,
      }) as MessageEvent,
    )
    fromFrame(payload, window)

    expect(seen).toEqual([])
    widget.destroy()
  })
})

describe('inline mount', () => {
  it('mounts into an existing target with the embed params on the src', () => {
    const widget = create({ appUrl: APP, mode: 'inline', target: '#mount', height: 700 })
    const iframe = document.querySelector('#mount iframe') as HTMLIFrameElement

    expect(iframe.style.height).toBe('700px')
    expect(iframe.src).toContain('embed=1')
    expect(iframe.src).toContain('parentOrigin=')

    widget.destroy()
    expect(document.querySelector('#mount iframe')).toBeNull()
  })

  it('fails soft when the target is missing, so a script-tag build keeps its global', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => create({ appUrl: APP, mode: 'inline', target: '#absent' })).not.toThrow()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
