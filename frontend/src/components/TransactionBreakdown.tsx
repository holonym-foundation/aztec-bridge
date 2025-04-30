import React from 'react'
import StyledImage from './StyledImage'

interface TransactionBreakdownProps {
  isOpen: boolean
  onToggle: () => void
}

const TransactionBreakdown: React.FC<TransactionBreakdownProps> = ({
  isOpen,
  onToggle,
}) => {
  if (!isOpen) {
    return (
      <button
        className='w-full mt-4 p-4 rounded-md bg-white font-semibold flex items-center justify-between'
        onClick={onToggle}>
        <span>Transaction breakdown</span>
        <StyledImage
          src='/assets/svg/buttons.svg'
          className='w-6 h-6'
          alt='open'
        />
      </button>
    )
  }
  return (
    <div className='bg-white rounded-md p-4 mt-4'>
      <div
        className='font-semibold text-lg mb-2 flex items-center justify-between cursor-pointer'
        onClick={onToggle}>
        <span>Back to Bridge</span>
        <button aria-label='Back to Bridge'>
          <StyledImage
            src='/assets/svg/buttons.svg'
            className='w-6 h-6 rotate-90'
            alt='close'
          />
        </button>
      </div>
      <div>
        <div className='mt-4 flex justify-between'>
          <p className='text-sm font-medium text-latest-grey-700'>
            Time to Aztec
          </p>
          <p className='text-latest-black-300 text-14 font-medium'>~2 mins</p>
        </div>
        <div className='mt-[14px] flex justify-between'>
          <p className='text-sm font-medium text-latest-grey-700'>Net fee</p>
          <p className='text-latest-black-300 text-14 font-medium'>$ 0.04</p>
        </div>
        <div className='mt-[14px] flex justify-between'>
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
            $ 0.01 <span className='text-latest-black-300'>0.0000029 ETH</span>
          </p>
        </div>
        <div className='mt-[14px] flex justify-between'>
          <div className='flex gap-1 items-center'>
            <p className='text-sm font-medium text-latest-grey-700'>
              Destination <br /> Gas fee
            </p>
            <StyledImage
              src='/assets/svg/info.svg'
              alt=''
              className='h-4 w-4'
            />
          </div>
          <p className='text-latest-grey-100 text-14 font-medium'>
            $ 0.03 <span className='text-latest-black-300'>0.0000103 ETH</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default TransactionBreakdown
