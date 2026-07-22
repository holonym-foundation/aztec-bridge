'use client'

import BannerAztecNodeError from '@/components/BannerAztecNodeError'
import BannerAztecTestnet from '@/components/BannerAztecTestnet'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ShieldOnboarding from '@/components/ShieldOnboarding'
import BridgeStepsRail from '@/components/BridgeStepsRail'
import ActivityDrawer from '@/components/ActivityDrawer'
import NotificationsDrawer from '@/components/NotificationsDrawer'
import HowItWorksModal from '@/components/model/HowItWorksModal'
import { useBridgeStore } from '@/stores/bridgeStore'
import { motion } from 'framer-motion'
import { MeshGradient } from '@paper-design/shaders-react'
import { usePathname } from 'next/navigation'
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
  // The bridge page (root route) and the transaction-progress screen both enforce the
  // no-scroll viewport budget (card capped at 90vh-5rem with internal scroll; footer nested
  // up into the card region's bottom padding). Other routes (docs, activity) scroll normally,
  // so the footer keeps its default position there.
  const isNoScrollRoute = pathname === '/' || pathname === '/progress'
  // The Tutorial + Activity drawers live here (not in any page) so they persist
  // across the app's main screens instead of disappearing on navigation. Shown on
  // the bridge, progress and activity flows; hidden on docs/complete/claim-fuel
  // where they'd be noise. The centered card owns no part of this — the dock is a
  // fixed, self-contained overlay, so card centering and the no-scroll budget are
  // untouched.
  const showDrawers =
    pathname === '/' ||
    (pathname?.startsWith('/progress') ?? false) ||
    (pathname?.startsWith('/activity') ?? false)
  return (
    <div
      className={`relative flex flex-col w-full min-w-0 overflow-x-hidden ${isNoScrollRoute ? 'h-screen overflow-y-hidden' : 'min-h-screen'}`}
      style={isNoScrollRoute ? { height: '100vh', minWidth: 0 } : { minHeight: '100vh', minWidth: 0 }}
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
          onboarding splash overlay (z-100) for connected users. See data-ob-splash. */}
      <div className="ob-header-elevate relative z-30 flex flex-col">
        <BannerAztecTestnet />
        <BannerAztecNodeError />
        <Header />
      </div>
      {/* Main content */}
      <div className="relative z-20 flex flex-col flex-grow min-h-0">
        <div className='flex-grow'>{children}</div>
        {/* On the no-scroll routes the outer container is pinned to exactly 100vh and clips
            overflow, so the footer sits flush at the bottom edge — the flex-grow content
            region above absorbs the slack. A negative top-margin here would instead lift the
            footer off the bottom and expose a dead strip beneath it. */}
        <Footer />
      </div>
      {/* Persistent binder dock: the drawer tabs stacked on the RIGHT edge,
          vertically centered. Fixed + pointer-events-none so it never adds page
          width/scroll and clicks pass through the gaps; each drawer re-enables its
          own pointer events. Tutorial sits above Activity above Messages; each
          opens its panel leftward as an absolutely-positioned overlay, so hovering
          one never reflows (splits apart) the others (#114). Desktop/tablet only
          (md+): the centered 360px card leaves no gutter on phones, so the tab
          would sit over the card edge — on mobile the same Tutorial/Activity live
          in the Header nav. */}
      {showDrawers && (
        <div className="pointer-events-none fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-2 md:flex">
          <BridgeStepsRail />
          <ActivityDrawer />
          <NotificationsDrawer />
        </div>
      )}
      <HowItWorksModal />
    </div>
  )
}
