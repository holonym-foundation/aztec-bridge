import React from 'react';

import NextImage, { ImageProps as NextImageProps } from 'next/image';

import clsxm from '@/utils/clsxm';

interface StyledImageProps extends NextImageProps {
  // className?: string;
}

const StyledImage: React.FC<StyledImageProps> = ({ src, alt, className, ...other }) => {
  return (
    <div className={clsxm('relative h-[272px] w-[232px]', className)}>
      <NextImage
        src={src}
        alt={alt || ''}
        fill
        {...other}
      />
    </div>
  );
};

export default StyledImage;
