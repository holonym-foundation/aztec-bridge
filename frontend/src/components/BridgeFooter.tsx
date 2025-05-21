import React from 'react'
import StyledImage from './StyledImage'

const BridgeFooter: React.FC = () => (
  <div className='flex justify-center gap-2 pb-3'>
    <img
      src='/assets/svg/logo.svg'
      alt='log'
    />
    <p className='text-12 font-medium text-latest-grey-600'>
      Secured by human.tech
    </p>
  </div>
)

export default BridgeFooter
