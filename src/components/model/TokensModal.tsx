/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import StyledImage from '../StyedImage';
const TOKENS = [
  {
    id: 1,
    img: '/assets/images/svg/USDC.svg',
    title: 'USDC',
    about: 'Ethereum',
    amount: '$50.27',
    percentage: '+0.62%',
  },
  {
    id: 2,
    img: '/assets/images/svg/USDT.svg',
    title: 'USDT',
    about: 'Ethereum',
    amount: '$14.02',
    percentage: '+0.53%',
  },
  {
    id: 3,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
  {
    id: 4,
    img: '/assets/images/svg/XDAI.svg',
    title: 'XDAI',
    about: 'Ethereum',
    amount: '$0.00',
    percentage: '0.00%',
  },
  {
    id: 5,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
  {
    id: 6,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
  {
    id: 7,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
  {
    id: 8,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
  {
    id: 7,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
  {
    id: 8,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
];

interface IProps {
  tokensData: any;
  setTokensData: (val: any) => void;
  isSend: string | null;
  handleClose: () => void;
}

export default function TokensModal({ setTokensData, tokensData, isSend, handleClose }: IProps) {
  console.log({ isSend });
  return (
    <div className='absolute inset-0 z-10 bg-white overflow-auto  '>
      <div className='p-5 '>
        <div className='bg-latest-grey-800 w-full  flex justify-between items-center rounded-[8px] py-1.5 px-2.5'>
          <div className='flex gap-1'>
            <StyledImage src='/assets/images/svg/search.svg' alt='' className='h-8 w-8' />
            <input
              type='text'
              placeholder='search'
              className='outline-none w-full bg-[transparent] text-latest-grey-600 text-16 font-medium'
            />
          </div>
          <button onClick={handleClose}>
            <StyledImage src='/assets/images/svg/cross.svg' alt='' className='h-3 w-3' />
          </button>
        </div>
      </div>
      <div className='px-2.5'>
        <p className='text-black text-16 py-1 px-2.5 font-semibold'>Tokens</p>
        <div>
          {TOKENS.map((items, idx) => {
            return (
              <div
                onClick={() => {
                  if (isSend === 'send') {
                    setTokensData({ ...tokensData, send: items });
                  } else {
                    setTokensData({ ...tokensData, received: items });
                  }
                  handleClose();
                }}
                key={`${items.id}___${idx}`}
                className='flex cursor-pointer justify-between p-2.5'>
                <div className='flex gap-2'>
                  <StyledImage src={items.img} alt='' className='h-10 w-10' />
                  <div>
                    <p className='text-16 font-medium text-latest-black-200'>{items.title}</p>
                    <p className='text-14 font-medium text-latest-grey-600'>{items.about}</p>
                  </div>
                </div>
                <div>
                  <p className='text-16 font-medium text-latest-black-200'>{items.amount}</p>
                  <p className='text-14 font-medium text-latest-grey-600'>{items.percentage}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
