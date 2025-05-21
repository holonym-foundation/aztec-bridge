'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BannerAztecTestnet from '@/components/BannerAztecTestnet'
import BannerAztecNodeError from '@/components/BannerAztecNodeError'
import { useBridgeStore } from '@/stores/bridgeStore'
import { motion, AnimatePresence } from 'framer-motion'
import { ToastContainer } from 'react-toastify'
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isPrivatePaymentsEnabled } = useBridgeStore()
  return (
    <motion.div
      initial={false}
      animate={{
        background:
          isPrivatePaymentsEnabled
            ? 'radial-gradient(#8B8EA8, #B3B1C8)'
            : 'radial-gradient(#E3E6FF, #FFFFFF)',
      }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
      className="min-h-screen flex flex-col w-full min-w-0"
      style={{ minHeight: '100vh', minWidth: 0 }}
    >
      <BannerAztecTestnet />
      <BannerAztecNodeError />
      <Header />
      <div className='flex-grow'>{children}</div>
      <Footer className='' />
      <ToastContainer />
    </motion.div>
  )
}
