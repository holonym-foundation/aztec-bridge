import clsxm from '@/utils/clsxm'
import React from 'react'

interface RootStyleProps extends React.PropsWithChildren {
  className?: string
  // Optional companion panel rendered beside the card on desktop and stacked
  // below it on mobile. Only the bridge page uses this.
  aside?: React.ReactNode
}

export default function RootStyle({ children, className, aside }: RootStyleProps) {
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

  if (!aside) {
    return <div className={`flex items-center min-h-[90vh] justify-center py-10`}>{card}</div>
  }

  // The wrapper is sized to the CARD, not the card+aside pair, so centering the
  // wrapper centers the card. On mobile the aside stacks below in normal flow;
  // at md+ the aside renders itself as an absolutely-positioned drawer (see
  // BridgeStepsRail) that peeks out from the wrapper's left edge without
  // contributing to its layout width.
  return (
    <div className={`flex items-center min-h-[90vh] justify-center py-10 px-4`}>
      <div className='relative flex w-full flex-col items-center gap-4 md:w-[360px] md:gap-0'>
        {card}
        {aside}
      </div>
    </div>
  )
}
