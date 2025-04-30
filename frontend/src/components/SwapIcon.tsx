import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface SwapIconProps {
  onClick: () => void;
}

const SwapIcon: React.FC<SwapIconProps> = ({ onClick }) => {
  const [swapRotation, setSwapRotation] = useState(0);

  const handleClick = () => {
    setSwapRotation(prev => prev + 180);
    onClick();
  };

  return (
    <motion.div 
      className='absolute mb-0 bottom-[-30px] left-0 right-0 text-center'
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.button 
        className='mx-auto w-11 h-11 flex items-center justify-center'
        onClick={handleClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.svg 
          width="44" 
          height="44" 
          viewBox="0 0 44 44" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          animate={{ rotate: swapRotation }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.rect 
            x="1" 
            y="43" 
            width="42" 
            height="42" 
            rx="21" 
            transform="rotate(-90 1 43)" 
            fill="white"
            initial={{ stroke: "#D4D4D4" }}
            // whileHover={{ stroke: "#3D3D3D" }}
            strokeWidth="2"
          />
          <g clipPath="url(#clip0_341_2798)">
            <motion.path 
              d="M26.1667 15.3334L26.1667 28.6667M26.1667 28.6667L22.8333 25.3334M26.1667 28.6667L29.5 25.3334M17.8333 28.6667L17.8333 15.3334M17.8333 15.3334L14.5 18.6667M17.8333 15.3334L21.1667 18.6667" 
              stroke="#3D3D3D" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
          </g>
          <defs>
            <clipPath id="clip0_341_2798">
              <rect width="20" height="20" fill="white" transform="translate(12 32) rotate(-90)"/>
            </clipPath>
          </defs>
        </motion.svg>
      </motion.button>
    </motion.div>
  );
};

export default SwapIcon; 