import React from 'react'
import StyledImage from './StyledImage'
import LoadingBar from './LoadingBar'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useWalletStore } from '@/stores/walletStore'

interface BridgeHeaderProps {
  onClick?: () => void
}

const BridgeHeader: React.FC<BridgeHeaderProps> = ({ onClick }) => {
  const { 
    getHeaderSteps, 
    headerStep,
    setHeaderStep
  } = useBridgeStore()

  const {
    isMetaMaskConnected,
    isAztecConnected
  } = useWalletStore()

  // Update step statuses based on wallet connections
  React.useEffect(() => {
    if (isMetaMaskConnected) {
      setHeaderStep(1, 'completed')
    } else {
      setHeaderStep(1, 'pending')
    }
    
    if (isAztecConnected) {
      setHeaderStep(2, 'completed')
    } else {
      setHeaderStep(2, 'pending')
    }
  }, [isMetaMaskConnected, isAztecConnected, setHeaderStep])

  const steps = getHeaderSteps()

  return (
    <div className='flex flex-[1_0_0] items-center gap-[12px] rounded-[136px] border border-[#D4D4D4] bg-white px-[16px] py-[4px] pl-[8px]'>
      <img
        src='/assets/svg/human.aztec.svg'
        alt=''
        className='h-[24px] w-[24px]'
      />

      <LoadingBar steps={steps} currentStep={headerStep} />
      <p
        className={`text-center text-[#0A0A0A] font-[700] text-[16px] leading-[24px] tracking-[0.32px] uppercase font-['Suisse_Intl']`}
        onClick={() => {
          if (onClick) {
            onClick()
          }
        }}>
        BRIDGE
      </p>
    </div>
  )
}

export default BridgeHeader
