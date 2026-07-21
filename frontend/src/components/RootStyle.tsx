import clsxm from '@/utils/clsxm'
import React from 'react'

interface RootStyleProps extends React.PropsWithChildren {
  className?: string
}

// Just the centered card. The side drawers (Tutorial / Activity) no longer live
// here — they're hoisted into a single fixed dock in ClientLayout so they persist
// across every app screen (bridge, progress, activity) instead of only the page
// that renders this card. That keeps card centering completely independent of the
// drawers: this wrapper is sized to the card, so the card is always centered.
export default function RootStyle({ children, className }: RootStyleProps) {
  return (
    // 85vh (not 90vh) + py-6 (not py-10): the app's top nav (~94px) lives ABOVE this
    // region, so a full 90vh reserve here plus the nav overflowed the viewport and
    // scrolled the whole page on short (<~940px) laptop windows. The reduced reserve keeps
    // the card centered while leaving room for the nav so the page never scrolls; the card's
    // own max-h-[calc(90vh-5rem)] budget (set by the caller) still caps its height.
    <div className={`flex items-center min-h-[85vh] justify-center py-6`}>
      <div
        className={clsxm(
          `relative rounded-xl bg-white shadow-[0px_383px_107px_0px_rgba(0,0,0,0),0px_245px_98px_0px_rgba(0,0,0,0.01),0px_138px_83px_0px_rgba(0,0,0,0.05),0px_61px_61px_0px_rgba(0,0,0,0.09),0px_15px_34px_0px_rgba(0,0,0,0.10)]`,
          // min-h floor lowered so a short window's card doesn't get force-grown past what
          // fits above the nav; the card sizes to content and is capped by max-h.
          'w-[360px] shrink-0 min-w-0 min-h-[560px] h-auto',
          className
        )}>
        {children}
      </div>
    </div>
  )
}
