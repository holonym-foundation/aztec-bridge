/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect } from 'react';
import RootStyle from '@/components/RootStyle';
import TextButton from '@/components/TextButton';
import { Geist, Geist_Mono } from 'next/font/google';
import { useRouter } from 'next/navigation';
import StyledImage from '@/components/StyedImage';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => router.push('/complete'), 2000);
  }, []);

  return (
    <RootStyle>
      <div>
        <div className=' bg-latest-grey-200 p-5'>
        <div  className='flex   items-center gap-3 max-w-[150px] mx-auto rounded-full bg-white  px-4 py-1'>
          <StyledImage src='/assets/svg/bridgeIcon.svg' alt='' className='h-5 w-5 ' />
          <p className=' font-bold text-20 '> BRIDGE</p>
          </div>
          <div className='bg-white rounded-md  mt-5  p-4'>
            <div className=' flex items-center justify-center'>
              <StyledImage src='/assets/svg/progress.svg' alt='' className='h-[56px]  w-[56px]' />
            </div>
            <p onClick={() => router.push('/complete')} className='text-center font-semibold text-md mt-5'>
              Transaction in progress
            </p>
            <hr className='text-latest-grey-300 my-3' />
            <div className='flex justify-between mt-[2px]'>
              <p className='text-14 font-medium text-latest-grey-100'>Estimated time </p>
              <p className='font-semibold text-14'>05:20</p>
            </div>
          </div>

          <div className='bg-white rounded-md  mt-4 p-4'>
            <div className='flex justify-between'>
              <div>
                <p className='text-14 font-semibold text-latest-grey-100'>From</p>
                <div className='flex  gap-2 mt-3'>
                  <StyledImage src='/assets/svg/ethLogo.svg' alt='' className='h-6 w-6' />
                  <p className='text-16 font-medium text-latest-black-100  w-[106px]'>Polygon</p>
                </div>
              </div>
              <div>
                <p className='text-14 font-semibold text-latest-grey-100'>To</p>
                <div className='flex  gap-2 mt-3'>
                  <StyledImage src='/assets/svg/aztec.svg' alt='' className='h-6 w-6' />
                  <p className='text-16 font-medium text-latest-black-100  w-[106px]'>Aztec</p>
                </div>
              </div>
            </div>
            <hr className='text-latest-grey-300 my-3' />
            <p className='text-32 text-black font-medium text-center'>1,99981 ETH</p>
            <p className='text-center text-16 font-medium text-latest-grey-500 mt-2'>$2,192.99</p>
          </div>
        </div>
      </div>
    </RootStyle>
  );
}
