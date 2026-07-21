'use client'

import BannerAztecNodeError from '@/components/BannerAztecNodeError'
import BannerAztecTestnet from '@/components/BannerAztecTestnet'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { useBridgeStore } from '@/stores/bridgeStore'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const MeshGradient = dynamic(
  () => import('@paper-design/shaders-react').then((m) => m.MeshGradient),
  { ssr: false },
)

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isPrivacyModeEnabled } = useBridgeStore()
  const pathname = usePathname()
  const isDocs = pathname?.startsWith('/docs') ?? false
  // Docs is a neutral reading view — keep the light background even when privacy mode is on.
  const showPrivacyBackground = isPrivacyModeEnabled && !isDocs
  return (
    <div className="relative min-h-screen flex flex-col w-full min-w-0" style={{ minHeight: '100vh', minWidth: 0 }}>
      {isDocs ? (
        <>
          {/* Near-white shader field; pink stays at the edges so body copy reads cleanly */}
          <div className="absolute inset-0 z-0">
            <MeshGradient
              colors={['#FFFFFF', '#FFFFFF', '#FEF6FA', '#FDE7F3', '#FCD4EA']}
              speed={0.12}
              distortion={0.85}
              swirl={0.12}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 40%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.7) 45%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0) 100%)',
            }}
          />
        </>
      ) : (
        /* Gradient background */
        <motion.div
          className="absolute inset-0 z-0"
          animate={{
            background: showPrivacyBackground
              ? 'radial-gradient(#6B6E88, #8B89A8)'
              : 'radial-gradient(#E3E6FF, #FFFFFF)',
          }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          style={{ willChange: 'background' }}
        />
      )}
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
    </div>
  )
}
