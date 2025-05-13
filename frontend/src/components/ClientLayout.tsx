'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BannerAztecTestnet from '@/components/BannerAztecTestnet'
import BannerAztecNodeError from '@/components/BannerAztecNodeError'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className='min-h-screen flex flex-col'>
      <BannerAztecTestnet />
      <BannerAztecNodeError />
      <Header />
      <div className='flex-grow'>{children}</div>
      <Footer className='' />
    </main>
  )
}
