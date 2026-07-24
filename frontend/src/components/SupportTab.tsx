'use client'

import React from 'react'
import { Icon } from '@iconify/react'
import { openSupport } from '@/utils/support'

// A binder tab that matches the Tutorial / Activity / Messages tabs but is an
// ACTION tab, not a drawer: clicking it opens the support widget and never
// expands a panel. If the widget is not reachable yet, openSupport() is a silent
// no-op and the native launcher stays visible as the fallback (shield.human.tech#86).
type SupportTabProps = { variant?: 'rail' | 'dock' }

const SupportTab: React.FC<SupportTabProps> = ({ variant = 'rail' }) => {
  const isDock = variant === 'dock'

  const handleOpen = () => {
    openSupport()
  }

  // Narrow-viewport dock (#243): a compact round icon button in the bottom-left
  // mobile dock, mirroring the Messages/Tutorial dock buttons' chrome.
  if (isDock) {
    return (
      <div className="pointer-events-auto relative">
        <button
          type="button"
          aria-label="Support"
          onClick={handleOpen}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#D4D4D4] bg-white shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)] transition-colors hover:border-[#0A0A0A]/[0.3]"
        >
          <Icon icon="ph:headset" width={18} height={18} className="text-[#737373]" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // Slim right-edge rail tab, stacked below Messages by the dock in ClientLayout.
  // No panel and no badge, so its width is fixed (never widens on open) and it
  // keeps the icon + vertical label rhythm of the sibling tabs.
  return (
    <div className="pointer-events-auto relative flex items-center justify-end">
      <button
        type="button"
        aria-label="Support"
        onClick={handleOpen}
        className="relative flex h-[144px] w-9 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-l-[12px] border border-r-0 border-[#D4D4D4] bg-white px-1.5 py-3.5 transition-colors duration-200 ease-out hover:border-[#0A0A0A]/[0.3]"
      >
        {/* Spacer keeps the headset icon vertically aligned with the sibling tabs,
            whose top slot carries a status dot / count badge this tab omits. */}
        <span aria-hidden="true" className="h-1.5 w-1.5" />
        <Icon icon="ph:headset" width={15} height={15} className="text-[#737373]" aria-hidden="true" />
        <span
          className="px-0.5 py-1 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#737373]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Support
        </span>
      </button>
    </div>
  )
}

export default SupportTab
