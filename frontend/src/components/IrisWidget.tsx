'use client'

import { useEffect } from 'react'

// Iris chat widget, top frame only.
//
// Re-homed here from the root layout when that became a server component (SSR for
// crawlers/agents): the loader is a client-side effect, so it can't live in the server
// layout. Mounted once by ClientLayout, client-side, after hydration.
//
// The widget auto-hides its own launcher whenever it finds any div/iframe that is
// position:fixed|absolute and covers more than half the viewport, assuming that can
// only be an open modal. Shield's full-bleed MeshGradient background (ClientLayout)
// matches that test on every route, so the launcher is hidden permanently — the bug
// is the widget's heuristic, not script loading, and it does not reproduce on a bare
// page. It hides by writing an inline style onto a node in a CLOSED shadow root, so
// the only override available to us is to open that root and outrank the inline
// style with !important. The widget assigns the host id before calling attachShadow,
// which is what makes this interception possible; if that ever stops holding, the
// patch no-ops and we are back to today's behaviour rather than something worse.
//
// Deliberately no cleanup that restores attachShadow: under StrictMode the effect's
// unmount/remount would tear the patch down before the async script ever runs.
export default function IrisWidget() {
  useEffect(() => {
    if (window.self !== window.top) return
    if (document.getElementById('iris-widget-loader')) return

    const nativeAttachShadow = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
      if (this.id !== 'iris-widget-host') return nativeAttachShadow.call(this, init)
      Element.prototype.attachShadow = nativeAttachShadow
      const root = nativeAttachShadow.call(this, { ...init, mode: 'open' })
      const style = document.createElement('style')
      style.textContent = '.iris-bubble { display: flex !important }'
      root.appendChild(style)
      return root
    }

    const s = document.createElement('script')
    s.id = 'iris-widget-loader'
    s.src = 'https://iris-v2-fqgd.onrender.com/widget/iris-widget.js'
    s.async = true
    s.setAttribute('data-iris-key', 'shield')
    s.addEventListener('error', () => {
      Element.prototype.attachShadow = nativeAttachShadow
    })
    document.body.appendChild(s)
  }, [])

  return null
}
