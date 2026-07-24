'use client'

import BannerAztecNodeError from '@/components/BannerAztecNodeError'
import BannerAztecTestnet from '@/components/BannerAztecTestnet'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ShieldOnboarding from '@/components/ShieldOnboarding'
import BridgeStepsRail from '@/components/BridgeStepsRail'
import ActivityDrawer from '@/components/ActivityDrawer'
import NotificationsDrawer from '@/components/NotificationsDrawer'
import SupportTab from '@/components/SupportTab'
import HowItWorksModal from '@/components/model/HowItWorksModal'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useNotificationsStore } from '@/stores/useNotificationsStore'
import { isSupportOpenable } from '@/utils/support'
import { motion } from 'framer-motion'
import { MeshGradient } from '@paper-design/shaders-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isPrivacyModeEnabled } = useBridgeStore()
  const pathname = usePathname()
  // Docs is a public, neutral reading surface: reachable without the onboarding gate and
  // rendered on a clean near-white background rather than the pink paper-shader field.
  const isDocs = pathname?.startsWith('/docs') ?? false
  // Docs is a neutral reading view — keep the light background even when privacy mode is on.
  const showPrivacyBackground = isPrivacyModeEnabled && !isDocs

  // See shield.human.tech#86 — never hide the native Iris launcher while it's the
  // only way to reach support. The Iris widget mounts client-side after hydration,
  // so poll briefly and only flip this on once the widget reports it's openable
  // (i.e. the Support tab can actually reach it). If it never becomes openable, the
  // native bubble stays visible as the working fallback.
  const [hideNativeBubble, setHideNativeBubble] = useState(false)
  useEffect(() => {
    if (isSupportOpenable()) {
      setHideNativeBubble(true)
      return
    }
    const id = window.setInterval(() => {
      if (isSupportOpenable()) {
        setHideNativeBubble(true)
        window.clearInterval(id)
      }
    }, 500)
    // Stop probing after a while; a widget that never reports openable keeps its bubble.
    const stop = window.setTimeout(() => window.clearInterval(id), 15000)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [])

  // The notifications feed persists to localStorage but rehydrates with
  // skipHydration, so restore it once on the client — server and first client
  // render stay empty (no hydration mismatch), then prior messages reappear.
  useEffect(() => {
    void useNotificationsStore.persist.rehydrate()
  }, [])

  return (
    <div
      // The bridge (/) and progress screens target a single-viewport, no-scroll fit
      // (card capped at 90vh-5rem, footer nested up into the card region). But that fit
      // is only achievable at comfortable heights. Clamp with min-height, never a fixed
      // height + overflow-hidden: at 720/800/900 the content fits and the container is
      // exactly 100vh so nothing scrolls, while on short viewports (or with an extra
      // banner / wallet-discovery modal present) the container grows past 100vh and the
      // document scrolls to reveal the footer instead of clipping it (#328).
      className="relative flex flex-col w-full min-w-0 overflow-x-hidden min-h-screen"
      style={{ minHeight: '100vh', minWidth: 0 }}
    >
      {/* Onboarding is skipped on docs so the guides render without connecting a wallet. */}
      {!isDocs && <ShieldOnboarding />}
      {/* Background: clean near-white surface on docs, pink paper-shader field elsewhere. */}
      {isDocs ? (
        <div className="absolute inset-0 z-0 bg-white" aria-hidden="true" />
      ) : (
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <MeshGradient
          colors={['#fff6fa', '#fde7f3', '#fcd4ea', '#fa8fc4']}
          speed={0.16}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <motion.div
          className="absolute inset-0"
          // initial={false} renders the background at its target on mount (no
          // enter animation) so when Privacy Mode is the default the dark field
          // is applied synchronously on first paint instead of animating up
          // from light — the toggle transition on later changes is unaffected (#94).
          initial={false}
          animate={{
            background: showPrivacyBackground
              ? 'rgba(31,8,22,0.66)'
              : 'linear-gradient(180deg, rgba(255,246,250,0.30), rgba(255,246,250,0.62))',
          }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          style={{ willChange: 'background' }}
        />
      </div>
      )}
      {/* Grain overlay */}
      {/* <motion.div
        className="absolute inset-0 z-10 pointer-events-none"
        animate={{
          opacity: isPrivacyModeEnabled ? 1 : 0,
        }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
        style={{
          backgroundImage: 'url(assets/images/bgGrain.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          willChange: 'opacity',
        }}
      /> */}
      {/* Header — kept in its own stacking wrapper so it can be lifted above the
          onboarding splash overlay (z-100) for connected users. See data-ob-splash.
          z-50 keeps the nav (banners + Header) ABOVE the binder dock (z-40) and its
          drawer panels, so an open drawer can never occlude the top nav (#318). The
          connected-splash elevation to z-130 still wins via `!important`. */}
      <div className="ob-header-elevate relative z-50 flex flex-col">
        <BannerAztecTestnet />
        <BannerAztecNodeError />
        <Header />
      </div>
      {/* Main content */}
      <div className="relative z-20 flex flex-col flex-grow min-h-0">
        <div className='flex-grow'>{children}</div>
        {/* When content fits, the outer container sits at exactly 100vh (min-height) and the
            flex-grow region above absorbs the slack, so the footer rests flush at the bottom
            edge with no dead strip beneath it. When content exceeds the viewport the container
            grows past 100vh and the document scrolls, keeping the footer reachable rather than
            clipped. A negative top-margin here would instead lift the footer off the bottom
            and expose a dead strip. */}
        <Footer />
      </div>
      {/* Persistent binder dock: app-shell chrome mounted once, so the Tutorial /
          Activity / Messages tabs are present on EVERY route and navigation never
          drops them (their badges stay live across routes because they read global
          stores, not page state). The dock is fixed + pointer-events-none so it
          never adds page width/scroll and clicks pass through the gaps; each drawer
          re-enables its own pointer events. Tutorial sits above Activity above
          Messages; each opens its panel leftward as an absolutely-positioned
          overlay, so hovering one never reflows (splits apart) the others (#114).
          Desktop/tablet only (md+): the centered 360px card leaves no gutter on
          phones, so the tab would sit over the card edge — the mobile dock below
          takes over there. */}
      <div className="pointer-events-none fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-2 md:flex">
        <BridgeStepsRail />
        <ActivityDrawer />
        <NotificationsDrawer />
        {/* Only surface the Support tab once the Iris widget is actually
            openable; until then the native bubble is the working entry point and
            a tab that can't open anything would be dead. See shield.human.tech#86. */}
        {hideNativeBubble && <SupportTab />}
      </div>
      {/* Below md the centered card leaves no right gutter, so the right-edge
          binder tabs would sit off-screen (#243). Relocate them to a compact,
          tappable dock in the bottom-LEFT corner, clear of the bottom-right
          support chat bubble. Each tab keeps its icon + badge and opens its
          panel as a bottom-anchored sheet. */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex items-end gap-2 md:hidden">
        <BridgeStepsRail variant="dock" />
        <ActivityDrawer variant="dock" />
        <NotificationsDrawer variant="dock" />
        {hideNativeBubble && <SupportTab variant="dock" />}
      </div>
      {/* See shield.human.tech#86 — hide the native Iris floating bubble ONLY once
          it's programmatically openable, so the Support tab replaces it without ever
          leaving support unreachable. Until then the native launcher stays visible. */}
      {hideNativeBubble && (
        <style dangerouslySetInnerHTML={{ __html: '#iris-widget-host { display: none !important }' }} />
      )}
      <HowItWorksModal />
    </div>
  )
}
