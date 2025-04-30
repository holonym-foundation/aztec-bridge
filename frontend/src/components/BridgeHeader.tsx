import React from 'react';
import StyledImage from './StyledImage';

interface BridgeHeaderProps {
  onClick: () => void;
}

const BridgeHeader: React.FC<BridgeHeaderProps> = ({ onClick }) => (
    <div className='flex items-center gap-3 max-w-[150px] mx-auto rounded-full bg-white px-4 py-1'>
      <StyledImage
        src='/assets/svg/bridgeIcon.svg'
        alt=''
        className='h-5 w-5'
      />
      <p
        className='font-bold text-20 cursor-pointer'
        onClick={onClick}
      >
        BRIDGE
      </p>
  </div>
);

export default BridgeHeader; 