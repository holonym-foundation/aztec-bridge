import { AztecWalletType } from '@/types/wallet'
import { AnimatePresence, motion } from 'framer-motion'
import StyledImage from '../StyledImage'

interface WalletSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: AztecWalletType) => void
}

export default function WalletSelectionModal({
  isOpen,
  onClose,
  onSelect,
}: WalletSelectionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className='absolute inset-0 bg-latest-grey-1000 z-20 rounded-lg'>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
            }}
            className='absolute bottom-0 right-0 left-0'>
            <div className='px-2.5 py-3 bg-white rounded-lg'>
              <div className='flex justify-between items-center mx-2.5 py-1'>
                <p className='text-latest-black-300 font-semibold text-16'>
                  Select Aztec Wallet
                </p>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}>
                  <StyledImage
                    src='/assets/svg/cross.svg'
                    alt=''
                    className='h-[14px] w-[14px] m-[2px]'
                  />
                </motion.button>
              </div>
              <div className='mt-4 mx-2.5'>
                <div className='grid grid-cols-2 gap-4'>
                  <motion.button
                    onClick={() => onSelect('azguard')}
                    className='flex flex-col items-center py-4 rounded-[8px] transition bg-[#F5F5F5] hover:bg-[#E5E5E5] '
                    style={{ minHeight: 120 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}>
                    <StyledImage
                      src='/assets/images/AZGuard.png'
                      alt='Azguard'
                      className='w-10 h-10 mb-2'
                    />
                    <span className='font-medium text-latest-black-300'>
                      Azguard
                    </span>
                  </motion.button>
                  <motion.button
                    onClick={() => onSelect('obsidion')}
                    className='flex flex-col items-center py-4 rounded-[8px] transition bg-[#F5F5F5] hover:bg-[#E5E5E5] '
                    style={{ minHeight: 120 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}>
                    <StyledImage
                      src='/assets/images/Obsidion.png'
                      alt='Obsidion'
                      className='w-10 h-10 mb-2'
                    />
                    <span className='font-medium text-latest-black-300'>
                      Obsidion
                    </span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
