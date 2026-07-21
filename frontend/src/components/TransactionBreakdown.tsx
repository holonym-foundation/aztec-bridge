import React from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import StyledImage from './StyledImage'

interface TransactionBreakdownProps {
  isOpen: boolean
  onToggle: () => void
  // Portal fee deducted from the bridged token. `bridgeFee` is undefined while
  // the fee rate is still loading.
  bridgeFee?: string
  bridgeFeeUsd?: string
  receiveAmount?: string
  tokenSymbol?: string
}

// True in-place accordion — the header stays put and the detail expands/collapses
// below it, so the From/To section above never has to unmount to make room.
const TransactionBreakdown: React.FC<TransactionBreakdownProps> = ({
  isOpen,
  onToggle,
  bridgeFee,
  bridgeFeeUsd,
  receiveAmount,
  tokenSymbol,
}) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className='mt-3 bg-[#F5F5F5] rounded-md overflow-hidden'>
      <button
        type='button'
        className='w-full p-3 flex items-center justify-between font-semibold text-sm text-latest-black-100'
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls='transaction-breakdown-detail'
      >
        <span>Transaction breakdown</span>
        <StyledImage
          src='/assets/svg/buttons.svg'
          className={`w-5 h-5 transition-transform ${isOpen ? '-rotate-90' : 'rotate-90'}`}
          alt=''
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id='transaction-breakdown-detail'
            key='breakdown-detail'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
            className='overflow-hidden'
          >
            <div className='px-3 pb-3 space-y-[14px]'>
              <div className='flex justify-between'>
                <p className='text-sm font-medium text-latest-grey-700'>
                  Time to Aztec
                </p>
                <p className='text-latest-black-300 text-14 font-medium'>~2 mins</p>
              </div>
              <div className='flex justify-between'>
                <div className='flex gap-1 items-center text-center'>
                  <p className='text-sm font-medium text-latest-grey-700'>
                    Bridge fee
                  </p>
                  <StyledImage
                    src='/assets/svg/info.svg'
                    alt=''
                    className='h-4 w-4'
                  />
                </div>
                <p className='text-latest-grey-100 text-14 font-medium'>
                  {bridgeFee != null ? (
                    <>
                      {bridgeFeeUsd != null && <>$ {bridgeFeeUsd} </>}
                      <span className='text-latest-black-300'>
                        {bridgeFee} {tokenSymbol}
                      </span>
                    </>
                  ) : (
                    <span className='text-latest-black-300'>—</span>
                  )}
                </p>
              </div>
              <div className='flex justify-between'>
                <p className='text-sm font-medium text-latest-grey-700'>You receive</p>
                <p className='text-latest-black-300 text-14 font-medium'>
                  {receiveAmount ?? '—'} {tokenSymbol}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TransactionBreakdown
