import React, { useState } from 'react';
import StyledImage from './StyledImage';
import { BridgeDirection, BridgeState, Network as NetworkType, Token as TokenType } from '@/types/bridge';
import { motion } from 'framer-motion';
import SwapIcon from './SwapIcon';

interface BridgeSectionProps {
  bridgeConfig: BridgeState;
  setIsFromSection: (isFrom: boolean) => void;
  setSelectNetwork: (open: boolean) => void;
  setSelectToken: (open: boolean) => void;
  inputAmount: string;
  setInputAmount: (amount: string) => void;
  l1NativeBalance: string | number | null | undefined;
  l1Balance: string | number | null | undefined;
  l2PublicBalance: string | number | null | undefined;
  direction: BridgeDirection;
  inputRef: React.RefObject<HTMLInputElement>;
  onSwap?: () => void;
}

const BridgeSection: React.FC<BridgeSectionProps> = ({
  bridgeConfig: bridge,
  setIsFromSection,
  setSelectNetwork,
  setSelectToken,
  inputAmount,
  setInputAmount,
  l1NativeBalance,
  l1Balance,
  l2PublicBalance,
  direction,
  inputRef,
  onSwap,
}) => {
  // Normalize balances to strings
  const l1NativeBalanceStr = l1NativeBalance != null ? l1NativeBalance.toString() : '';
  const l1BalanceStr = l1Balance != null ? l1Balance.toString() : '';
  const l2PublicBalanceStr = l2PublicBalance != null ? l2PublicBalance.toString() : '';

  // Swap icon rotation state
  const [swapRotation, setSwapRotation] = useState(0);
  const handleSwapClick = () => {
    setSwapRotation(prev => prev + 180);
    if (onSwap) onSwap();
  };

  return (
    <div className="flex flex-col">
      {/* From Section */}
      <div className="mt-2 bg-white rounded-md p-4 relative">
        <p className="text-14 font-semibold text-latest-grey-100">From</p>
        <div className='flex justify-between'>
          {/* Network selector */}
          <div
            className='mt-4 flex gap-2 items-center rounded-[12px] cursor-pointer bg-latest-grey-200 p-[2px] max-w-[172px]'
            onClick={() => {
              setIsFromSection(true);
              setSelectNetwork(true);
            }}
          >
            <StyledImage
              src={bridge.from.network?.img || '/assets/svg/ethLogo.svg'}
              alt=''
              className='h-6 w-6'
            />
            <p className='text-16 font-medium text-latest-black-100 w-[106px]'>
              {bridge.from.network?.title}
            </p>
            <StyledImage
              src='/assets/svg/dropDown.svg'
              alt=''
              className='h-2.5 w-1.5 p-1.5 mr-1.5'
            />
          </div>
          {/* Token selector */}
          <div
            className='mt-4 flex gap-2 items-center rounded-md cursor-pointer bg-latest-grey-200 p-[2px]'
            onClick={() => {
              setIsFromSection(true);
              setSelectToken(true);
            }}
          >
            <StyledImage
              src={bridge.from.token?.img || ''}
              alt=''
              className='h-6 w-6'
            />
            <p className='text-16 font-medium text-latest-black-100'>
              {/* {bridge.from.token?.title} */}
              {bridge.from.token?.symbol}
            </p>
            <StyledImage
              src='/assets/svg/dropDown.svg'
              alt=''
              className='h-2.5 w-1.5 p-1.5 mr-1.5'
            />
          </div>
        </div>
        <hr className='text-latest-grey-300 my-3' />
        <div className='flex justify-between my-1'>
          <input
            ref={inputRef}
            type='text'
            placeholder='0'
            value={inputAmount}
            onChange={e => setInputAmount(e.target.value)}
            className='max-w-[150px] placeholder-latest-grey-400 outline-none bg-[transparent] text-32 font-medium'
            autoFocus
          />
          <div className='flex flex-col gap-2'>
            <div className='flex gap-2 w-max'>
              <p className='text-latest-grey-500 text-12 font-medium'>Native Balance:</p>
              <div className='flex gap-1'>
                <p className='text-latest-grey-500 text-12 font-medium break-all'>
                  {direction === BridgeDirection.L1_TO_L2 ? l1NativeBalanceStr : ''}
                </p>
                <p className='text-latest-grey-500 text-12 font-medium'>
                  {direction === BridgeDirection.L1_TO_L2 ? 'ETH' : ''}
                </p>
              </div>
            </div>
            <div className='flex gap-2 w-full justify-between items-center'>
              <p className='text-latest-grey-500 text-12 font-medium'>Balance:</p>
              <div className='flex gap-1 ml-auto'>
                <p className='text-latest-grey-500 text-12 font-medium break-all'>
                  {direction === BridgeDirection.L1_TO_L2 ? l1BalanceStr : l2PublicBalanceStr}
                </p>
                <p className='text-latest-grey-500 text-12 font-medium'>{bridge.from.token?.title}</p>
              </div>
            </div>
          </div>
        </div>
        <div className='flex justify-between mt-2'>
          <p className='text-16 font-medium text-latest-grey-500'>{/* USD value placeholder */}</p>
          <p
            className='text-14 font-medium text-latest-black-200 bg-latest-grey-200 px-2.5 rounded-[32px] h-5 cursor-pointer'
            onClick={() =>
              setInputAmount(
                direction === BridgeDirection.L1_TO_L2 ? l1BalanceStr : l2PublicBalanceStr
              )
            }
          >
            Max
          </p>
        </div>
        {onSwap && <SwapIcon onClick={onSwap} />}
      </div>

      {/* To Section */}
      <div className="mt-2 bg-white rounded-md p-4">
        <p className="text-14 font-semibold text-latest-grey-100">To</p>
        <div className='flex justify-between'>
          {/* Network selector */}
          <div
            className='mt-4 flex gap-2 items-center rounded-[12px] cursor-pointer bg-latest-grey-200 p-[2px] max-w-[172px]'
            onClick={() => {
              setIsFromSection(false);
              setSelectNetwork(true);
            }}
          >
            <StyledImage
              src={bridge.to.network?.img || ''}
              alt=''
              className='h-6 w-6'
            />
            <p className='text-16 font-medium text-latest-black-100 w-[106px]'>
              {bridge.to.network?.title}
            </p>
            <StyledImage
              src='/assets/svg/dropDown.svg'
              alt=''
              className='h-2.5 w-1.5 p-1.5 mr-1.5'
            />
          </div>
          {/* Token selector */}
          <div
            className='mt-4 flex gap-2 items-center rounded-md cursor-pointer bg-latest-grey-200 p-[2px]'
            onClick={() => {
              setIsFromSection(false);
              setSelectToken(true);
            }}
          >
            <StyledImage
              src={bridge.to.token?.img || ''}
              alt=''
              className='h-6 w-6'
            />
            <p className='text-16 font-medium text-latest-black-100'>
              {/* {bridge.to.token?.title} */}
              {bridge.to.token?.symbol}
            </p>
            <StyledImage
              src='/assets/svg/dropDown.svg'
              alt=''
              className='h-2.5 w-1.5 p-1.5 mr-1.5'
            />
          </div>
        </div>
        <hr className='text-latest-grey-300 my-3' />
        <div className='flex justify-between'>
          <p className='text-14 font-medium text-latest-grey-100'>You will receive</p>
          <p className='text-black text-14 font-semibold'>{inputAmount} {bridge.to.token?.title}</p>
        </div>
        <div className='flex justify-between mt-2'>
          <p className='text-latest-grey-500 text-12 font-medium'>Current Balance:</p>
          <p className='text-latest-grey-500 text-12 font-medium break-all'>
            {direction === BridgeDirection.L1_TO_L2 ? l2PublicBalanceStr : l1BalanceStr} {bridge.to.token?.title}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BridgeSection; 