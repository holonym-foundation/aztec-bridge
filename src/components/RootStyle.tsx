/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

export default function RootStyle({ children, }: any) {
  return (
    <div className='flex items-center min-h-[100vh] p-6 justify-center'>
      <div className='w-[380px] relative font-inter bg-latest-grey-200 rounded-lg min-h-[600px]  overflow-hidden'>
        {children}
      </div>
    </div>
  );
}
