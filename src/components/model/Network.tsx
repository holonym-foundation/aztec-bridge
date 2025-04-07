import React from 'react';
import StyledImage from '../StyedImage';

const NETWORK = [
  {
    id: 1,
    img: '/assets/svg/ethereum.svg',
    title: 'Ethereum',
  },
  {
    id: 2,
    img: '/assets/svg/op.svg',
    title: 'Optimism',
  },
  {
    id: 3,
    img: '/assets/svg/polygon.svg',
    title: 'Polygon',
  },
  {
    id: 4,
    img: '/assets/svg/arbitrum.svg',
    title: 'Arbitrum',
  },
  {
    id: 5,
    img: '/assets/svg/gn.svg',
    title: 'Gnosis',
  },
];

interface IProps {
  networkData: any;
  setNetworkData: (val: any) => void;
  isSend: boolean | null;
  handleClose: () => void;
}

export default function Network({ networkData, setNetworkData, isSend, handleClose }: IProps) {
  return (
    <div className='absolute inset-0 z-10 p-5 bg-latest-grey-900'>
      <div className=''>
        <div className='max-w-[344px] mx-auto w-full  bg-white rounded-lg p-2.5 '>
          <div className='flex justify-between max-w-[200px]'>
            <button onClick={handleClose} className='p-1.5 rounded-full hover:bg-gray-200'>
              <StyledImage src='/assets/svg/cross.svg' alt='' className='h-3 w-3' />
            </button>
            <p className='text-center text-latest-black-400  text-16 font-medium'>Switch network</p>
          </div>
          <input
            type='text'
            placeholder='Search network'
            className=' my-2.5  py-2.5 px-4 rounded-[8px] outline-none bg-latest-grey-800 w-full '
          />
          {NETWORK.map((items, idx) => {
            return (
              <div
                onClick={() => {
                  handleClose();
                  if (isSend) {
                    setNetworkData({ ...networkData, send: items });
                  } else {
                    setNetworkData({ ...networkData, received: items });
                  }
                }}
                key={`${items.id}___${idx}`}
                className=' hover:bg-latest-red-100 cursor-pointer p-2.5 flex gap-2'>
                <StyledImage src={items.img} alt='' className='h-6 w-6' />
                <p className='text-16 font-medium text-latest-black-100'>{items.title}</p>
              </div>
            );
          })}
        </div>
        <div className='max-w-[344px]  bg-white rounded-lg mt-2 mx-auto w-full  p-2.5 flex justify-between '>
          <div className='flex gap-2'>
            <StyledImage src='/assets/svg/silk.svg' alt='' className='h-10 w-10' />
            <div>
              <p className='text-latest-black-100 text-16 font-medium'>silk.sc</p>
              <p className='text-latest-grey-600 text-14 font-medium'>Not connected</p>
            </div>
          </div>
          <img src='/assets/svg/Toggle.svg' alt='' />
        </div>
      </div>
    </div>
  );
}
