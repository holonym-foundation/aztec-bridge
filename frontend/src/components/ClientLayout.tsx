'use client'

import BannerAztecNodeError from '@/components/BannerAztecNodeError'
import BannerAztecTestnet from '@/components/BannerAztecTestnet'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ShieldOnboarding from '@/components/ShieldOnboarding'
import HowItWorksModal from '@/components/model/HowItWorksModal'
import { useBridgeStore } from '@/stores/bridgeStore'
import { motion } from 'framer-motion'
import { MeshGradient } from '@paper-design/shaders-react'
import { usePathname } from 'next/navigation'
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isPrivacyModeEnabled } = useBridgeStore()
  const pathname = usePathname()
  // Docs is a neutral reading view — keep the light background even when privacy mode is on.
  const showPrivacyBackground = isPrivacyModeEnabled && !(pathname?.startsWith('/docs') ?? false)
  return (
    <div className="relative min-h-screen flex flex-col w-full min-w-0" style={{ minHeight: '100vh', minWidth: 0 }}>
      <ShieldOnboarding />
      {/* Paper-shader background */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <MeshGradient
          colors={['#fff6fa', '#fde7f3', '#fcd4ea', '#fa8fc4']}
          speed={0.16}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <motion.div
          className="absolute inset-0"
          animate={{
            background: showPrivacyBackground
              ? 'rgba(31,8,22,0.66)'
              : 'linear-gradient(180deg, rgba(255,246,250,0.30), rgba(255,246,250,0.62))',
          }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          style={{ willChange: 'background' }}
        />
      </div>
      {/* Grain overlay */}
      {/* <motion.div
        className="absolute inset-0 z-10 pointer-events-none"
        animate={{
          opacity: isPrivacyModeEnabled ? 1 : 0,
        }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
        style={{
          backgroundImage: 'url(assets/images/bgGrain.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          willChange: 'opacity',
        }}
      /> */}
      {/* Main content */}
      <div className="relative z-20 flex flex-col min-h-screen">
        <BannerAztecTestnet />
        <BannerAztecNodeError />
        <Header />
        <div className='flex-grow'>{children}</div>
        <Footer className='' />
      </div>
      <HowItWorksModal />
    </div>
  )
}
