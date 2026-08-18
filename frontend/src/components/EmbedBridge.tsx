'use client'

import { emitReady, emitToParent, onParentMessage } from '@/lib/embed/child'
import { getEmbedContext, hasOpenInAppOverlay, resolveEmbedRoute } from '@/lib/embed/mode'
import { installStorageAccessGestureHook } from '@/lib/embed/storageAccess'
import { useWalletStore } from '@/stores/walletStore'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * The partner-side channel: announces the framed app, mirrors navigation and
 * wallet state outward, and accepts navigate/close from the host. Renders
 * nothing and no-ops entirely outside embed mode.
 */
export default function EmbedBridge() {
  const { isEmbedded } = getEmbedContext()
  const router = useRouter()
  const pathname = usePathname()

  const waapAddress = useWalletStore((s) => s.waapAddress)
  const waapChainId = useWalletStore((s) => s.waapChainId)
  const isWaapConnected = useWalletStore((s) => s.isWaapConnected)
  const wasConnected = useRef(false)

  useEffect(() => {
    if (!isEmbedded) return
    emitReady()
    return installStorageAccessGestureHook()
  }, [isEmbedded])

  useEffect(() => {
    if (!isEmbedded) return
    return onParentMessage((message) => {
      switch (message.type) {
        case 'navigate': {
          // Only same-app paths — a full URL here would let the host drive the
          // frame to an arbitrary origin under Shield's chrome.
          const route = resolveEmbedRoute(message.route, window.location.origin)
          if (route) router.push(route)
          break
        }
        default:
          break
      }
    })
  }, [isEmbedded, router])

  useEffect(() => {
    if (!isEmbedded || !pathname) return
    emitToParent({ type: 'state', route: pathname })
  }, [isEmbedded, pathname])

  // Escape has to be forwarded from in here. Once focus moves inside the frame
  // the host page stops seeing keystrokes entirely, so its own Esc handler goes
  // dead the moment the user interacts with Shield — which is immediately.
  useEffect(() => {
    if (!isEmbedded) return
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // ...but only when Shield itself has nothing to close, or one keypress
      // would close the in-app panel AND tear the widget down behind it.
      if (hasOpenInAppOverlay()) return
      emitToParent({ type: 'close' })
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [isEmbedded])

  useEffect(() => {
    if (!isEmbedded) return
    if (isWaapConnected && waapAddress) {
      wasConnected.current = true
      emitToParent({ type: 'wallet:connected', address: waapAddress, chainId: waapChainId ?? 0 })
    } else if (wasConnected.current) {
      wasConnected.current = false
      emitToParent({ type: 'wallet:disconnected' })
    }
  }, [isEmbedded, isWaapConnected, waapAddress, waapChainId])

  return null
}
