import React from 'react';

import clsxm from '@/utils/clsxm';

interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  isLoading?: boolean;
  transition?: boolean;
  variant?: 'contained' | 'outlined';
}

const TextButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, disabled: buttonDisabled, isLoading, transition, variant = 'contained', ...other }, ref) => {
    return (
      <button
        ref={ref}
        className={clsxm(
          'bg-black text-white flex gap-2 py-[10px] rounded-lg items-center justify-center w-full font-semibold h-full hover:bg-silk-600',
          buttonDisabled && '!bg-[#9D9D9D] !shadow-none !cursor-not-allowed text-neutral-200',
          className,
        )}
        disabled={isLoading || buttonDisabled}
        {...other}>
        {children}
      </button>
    );
  },
);
export default TextButton;
