'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useL2PendingTxCount } from '@/hooks/useL2Operations'

const BannerAztecTestnet = () => {
  const [isVisible, setIsVisible] = useState(true)
  const { data: pendingTxCount } = useL2PendingTxCount()
  const showBanner = isVisible && pendingTxCount && pendingTxCount > 40

  if (!showBanner) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 1 }}
        className='bg-[#E5EFFF] text-[#17235E] relative flex items-center justify-center px-4 py-4 rounded-lg text-sm font-semibold w-full'>
        <div className='flex items-center gap-3'>
          <img src='/assets/svg/alert.svg' alt='Alert' className='w-6 h-6' />
          <span>
            The Aztec Testnet is congested right now. Your transactions may take
            longer or may be dropped.
          </span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className='absolute right-4 hover:opacity-70 transition-opacity'>
          <img src='/assets/svg/cross.svg' alt='Close' className='w-4 h-4' />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}

export default BannerAztecTestnet
