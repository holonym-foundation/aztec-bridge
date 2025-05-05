import React from 'react'
import StyledImage from './StyledImage'

const BridgeFooter: React.FC = () => (
  <div className='flex justify-center gap-2 pb-3'>
    <StyledImage
      src='/assets/svg/silk0.4.svg'
      alt=''
      className='h-4 w-[14px]'
    />
    <p className='text-12 font-medium text-latest-grey-600'>
      {' '}
      secured by human.tech
    </p>
  </div>
)

export default BridgeFooter
