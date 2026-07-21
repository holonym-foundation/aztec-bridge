import clsxm from '@/utils/clsxm'
import React from 'react'

interface RootStyleProps extends React.PropsWithChildren {
  className?: string
  // Optional companion panel rendered beside the card on desktop and stacked
  // below it on mobile. Only the bridge page uses this.
  aside?: React.ReactNode
  // Optional mirror of `aside` for a second drawer peeking from the card's
  // right edge (e.g. ActivityDrawer). Same centering guarantee as `aside`:
  // it self-positions absolutely and contributes no layout width.
  asideRight?: React.ReactNode
}

export default function RootStyle({ children, className, aside, asideRight }: RootStyleProps) {
  const card = (
    <div
      className={clsxm(
        `relative rounded-xl bg-white shadow-[0px_383px_107px_0px_rgba(0,0,0,0),0px_245px_98px_0px_rgba(0,0,0,0.01),0px_138px_83px_0px_rgba(0,0,0,0.05),0px_61px_61px_0px_rgba(0,0,0,0.09),0px_15px_34px_0px_rgba(0,0,0,0.10)]`,
        'w-[360px] shrink-0 min-w-0 min-h-[650px] h-auto',
        className
      )}>
      {children}
    </div>
  )

  if (!aside && !asideRight) {
    return <div className={`flex items-center min-h-[90vh] justify-center py-10`}>{card}</div>
  }

  // The wrapper is sized to the CARD, not the card+aside(s), so centering the
  // wrapper centers the card. On mobile each aside stacks below in normal flow;
  // at md+ each aside renders itself as an absolutely-positioned drawer (see
  // BridgeStepsRail for the left one, ActivityDrawer for the right one) that
  // peeks out from the wrapper's edge without contributing to its layout width,
  // so the two drawers can never collide with each other or push the card off-center.
  return (
    <div className={`flex items-center min-h-[90vh] justify-center py-10 px-4`}>
      <div className='relative flex w-full flex-col items-center gap-4 md:w-[360px] md:gap-0'>
        {card}
        {aside}
        {asideRight}
      </div>
    </div>
  )
}
