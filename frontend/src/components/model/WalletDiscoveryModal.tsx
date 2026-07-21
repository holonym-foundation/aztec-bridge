import { useState } from 'react'
import StyledImage from '../StyledImage'
import { motion, AnimatePresence } from 'framer-motion'
import { Oval } from 'react-loader-spinner'
import type { WalletProvider } from '@/utils/walletSdkConnection'

interface WalletDiscoveryModalProps {
  isOpen: boolean
  wallets: Array<{ name: string; provider: WalletProvider }>
  isDiscovering: boolean
  onSelectWallet: (provider: WalletProvider) => void
  onClose: () => void
  webWalletUrl?: string
  onConnectWebWallet?: (url: string) => void
}

export default function WalletDiscoveryModal({
  isOpen,
  wallets,
  isDiscovering,
  onSelectWallet,
  onClose,
  webWalletUrl = '',
  onConnectWebWallet,
}: WalletDiscoveryModalProps) {
  const [urlInput, setUrlInput] = useState(webWalletUrl)

  const trimmedUrl = urlInput.trim()
  const isValidUrl = /^https?:\/\/.+/i.test(trimmedUrl)

  const submitWebWallet = () => {
    if (!isValidUrl || !onConnectWebWallet) return
    onConnectWebWallet(trimmedUrl)
  }

  if (!isOpen) return null

  const noWalletsFound = !isDiscovering && wallets.length === 0

  return (
    <AnimatePresence>
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
                {noWalletsFound
                  ? 'No Aztec Wallet Found'
                  : 'Select Aztec Wallet'}
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
              {onConnectWebWallet && (
                <div className='mb-4'>
                  <label className='block text-latest-grey-600 text-12 font-medium mb-1.5'>
                    Web wallet URL
                  </label>
                  <div className='flex gap-2'>
                    <input
                      type='url'
                      inputMode='url'
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitWebWallet()
                      }}
                      placeholder='https://your-wallet.vercel.app'
                      className='flex-1 min-w-0 px-3 py-2 rounded-[8px] bg-[#F5F5F5] text-14 text-latest-black-300 outline-none focus:ring-2 focus:ring-[#81133B]'
                    />
                    <motion.button
                      onClick={submitWebWallet}
                      disabled={!isValidUrl}
                      whileHover={isValidUrl ? { scale: 1.02 } : undefined}
                      whileTap={isValidUrl ? { scale: 0.98 } : undefined}
                      className='px-4 py-2 rounded-[8px] bg-latest-black-300 text-white text-14 font-medium disabled:opacity-40 disabled:cursor-not-allowed'>
                      Connect
                    </motion.button>
                  </div>
                  {trimmedUrl && !isValidUrl && (
                    <p className='text-red-500 text-12 mt-1'>Enter a valid http(s) URL</p>
                  )}
                </div>
              )}

              {isDiscovering && wallets.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className='flex flex-col items-center py-8 gap-4'>
                  <Oval
                    height={36}
                    width={36}
                    color='#3B3B3B'
                    secondaryColor='#D4D4D4'
                    strokeWidth={4}
                  />
                  <p className='text-latest-grey-600 text-14'>
                    Searching for Aztec wallets...
                  </p>
                </motion.div>
              )}

              {wallets.length > 0 && (
                <div className='flex flex-col gap-3 mb-4'>
                  {wallets.map((w, i) => (
                    <motion.button
                      key={w.provider.id ?? i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => onSelectWallet(w.provider)}
                      className='flex items-center gap-3 p-4 rounded-[8px] bg-[#F5F5F5] hover:bg-[#E5E5E5] transition-colors'
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}>
                      <StyledImage
                        src='/assets/svg/aztec-wallet-logo.svg'
                        alt={w.name}
                        className='w-8 h-8'
                      />
                      <span className='font-medium text-latest-black-300'>
                        {w.name}
                      </span>
                    </motion.button>
                  ))}
                  {isDiscovering && (
                    <p className='text-latest-grey-600 text-12 text-center'>
                      Still searching for more wallets...
                    </p>
                  )}
                </div>
              )}

              {noWalletsFound && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}>
                  <p className='text-latest-grey-600 text-14 mb-6'>
                    No Aztec wallet extensions were detected. Install one to
                    continue.
                  </p>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className='bg-latest-grey-200 p-4 rounded-lg mb-6 flex items-center gap-4'>
                    <StyledImage
                      src='/assets/svg/aztec-wallet-logo.svg'
                      alt='Aztec Wallet'
                      className='w-10 h-10'
                    />
                    <p className='text-latest-grey-600 text-14'>
                      An Aztec wallet extension lets you interact privately with
                      the Aztec network
                    </p>
                  </motion.div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className='flex justify-center gap-2 mt-4 mb-2'>
                <StyledImage
                  src='/assets/svg/silk0.4.svg'
                  alt=''
                  className='h-4 w-[14px]'
                />
                <p className='text-12 font-medium text-latest-grey-600'>
                  Secured by human.tech
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
