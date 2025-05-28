import clsxm from '@/utils/clsxm'
import React from 'react'
import { ToastContentProps } from 'react-toastify'
import { Oval } from 'react-loader-spinner'

interface LoadingToastProps extends Partial<ToastContentProps> {
  heading?: string
  message?: string
}

const LoadingToast = ({
  closeToast,
  toastProps,
  heading,
  message,
}: LoadingToastProps) => (
  <div className='flex items-center gap-4 w-full'>
    <div className='flex items-center justify-center' style={{ width: heading ? 54 : 44, height: heading ? 54 : 44 }}>
      <Oval
        height={heading ? 32 : 24}
        width={heading ? 32 : 24}
        color='#0083E0'
        visible={true}
        ariaLabel='oval-loading'
        secondaryColor='#E5E5E5'
        strokeWidth={3}
        strokeWidthSecondary={3}
      />
    </div>
    <div className='flex flex-col justify-center items-start gap-[4px] flex-1'>
      {heading && (
        <span className='text-[#0A0A0A] font-sans text-[14px] font-semibold leading-[20px]'>
          {heading}
        </span>
      )}
      {message && (
        <span
          className={clsxm(
            'text-[#737373] font-sans leading-[15.6px]',
            heading ? 'text-[12px]' : 'text-[16px]',
            heading && 'font-medium'
          )}>
          {message}
        </span>
      )}
    </div>
  </div>
)

export default LoadingToast 