import React from 'react'
import { motion } from 'framer-motion'

interface Step {
  id: number
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
}

interface LoadingBarProps {
  steps: Step[]
  currentStep: number
  color?: string
  showLabel?: boolean
}

const LoadingBar: React.FC<LoadingBarProps> = ({
  steps,
  currentStep,
  color = '#FF990A',
  showLabel = false,
}) => {
  // Calculate progress based on completed steps
  const completedSteps = steps.filter(step => step.status === 'completed').length
  const progress = (completedSteps / steps.length) * 100

  return (
    <div className='w-full max-w-md mx-auto'>
      {/* Background bar */}
      <div className='h-1 w-full rounded-full bg-[#E5E5E5] overflow-hidden'>
        {/* Animated fill */}
        <motion.div
          className='h-full rounded-full relative'
          style={{ 
            backgroundColor: color,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        >
          {/* Glow effect */}
          {/* <motion.div
            className='absolute inset-0'
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
              filter: 'blur(4px)',
            }}
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          /> */}
        </motion.div>
      </div>

      {/* Optional step label */}
      {showLabel && (
        <motion.div
          className='text-center mt-2'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}>
          <motion.p
            key={steps[currentStep]?.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='text-neutral-600 text-sm'>
            {/* {steps[currentStep]?.label || 'Processin ...'} */}
            {steps[currentStep]?.label}
          </motion.p>
        </motion.div>
      )}
    </div>
  )
}

export default LoadingBar
