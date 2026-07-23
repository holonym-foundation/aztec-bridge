import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Motion values mirrored from the human-tech design system (docs/tokens.css).
// --dur-enter / --ease-out for the slide-up entrance, --dur-enter / --ease-spring
// for the swap rotation (icon active state), --dur-fast / --ease-default for hover.
const DS_DUR_FAST = 0.15;
const DS_DUR_ENTER = 0.32;
const DS_EASE_DEFAULT: [number, number, number, number] = [0.4, 0, 0.2, 1];
const DS_EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const DS_EASE_SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

interface SwapIconProps {
  onClick: () => void;
}

const SwapIcon: React.FC<SwapIconProps> = ({ onClick }) => {
  const [swapRotation, setSwapRotation] = useState(0);
  // Match the design-system motion tokens (durations + easing curves) and honor
  // the user's reduced-motion preference, like the accordions and steps rail.
  const shouldReduceMotion = useReducedMotion();

  const handleClick = () => {
    setSwapRotation(prev => prev + 180);
    onClick();
  };

  return (
    <motion.div
      className='absolute mb-0 bottom-[-30px] left-0 right-0 text-center'
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_OUT }}
    >
      <motion.button
        className='mx-auto w-11 h-11 flex items-center justify-center'
        onClick={handleClick}
        whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
      >
        <motion.svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          animate={{ rotate: shouldReduceMotion ? 0 : swapRotation }}
          transition={{ duration: shouldReduceMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SPRING }}
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
              whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
              transition={{ duration: shouldReduceMotion ? 0 : DS_DUR_FAST, ease: DS_EASE_DEFAULT }}
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