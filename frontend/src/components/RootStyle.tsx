import React from 'react';

export default function RootStyle({ children, }: { children: React.ReactNode }) {
  return (
    <div className='flex items-center min-h-[100vh] justify-center'>
      <div className='w-[380px] relative font-inter bg-latest-grey-200 rounded-lg'>
        {children}
      </div>
    </div>
  );
}
