'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { useL2NodeIsReady } from '@/hooks/useL2Operations'

const BannerAztecNodeError = () => {
  const {
    isError: l2NodeIsReadyIsError,
    isLoading: l2NodeIsReadyLoading,
  } = useL2NodeIsReady()

  if (!l2NodeIsReadyIsError || l2NodeIsReadyLoading) return null


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 1 }}
      className='z-50 bg-[#FFEBEB] text-[#500807] flex items-center justify-center px-4 py-4 rounded-lg text-sm font-semibold w-full'>
      <div className='flex items-center gap-3'>
        <div className='w-6 h-6'>
          <svg
            width='28'
            height='28'
            viewBox='0 0 28 28'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'>
            <circle
              cx='14'
              cy='14'
              r='12'
              stroke='#500807'
              strokeWidth='2'
              fill='none'
            />
            <path
              d='M9 9L19 19M19 9L9 19'
              stroke='#500807'
              strokeWidth='2'
              strokeLinecap='round'
            />
          </svg>
        </div>
        <span>
          Aztec Node is not available.
          Bridge operations are temporarily disabled.
          Please try again later.
        </span>
      </div>
    </motion.div>
  )
}

export default BannerAztecNodeError 