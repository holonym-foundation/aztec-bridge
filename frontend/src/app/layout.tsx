import { Providers } from '@/providers'
import { getConfig } from '@/wagmi'
import type { Metadata } from 'next'
import { cookieToInitialState } from 'wagmi'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { init as initDatadog } from '@/utils/datadog'
import BannerAztecTestnet from '@/components/BannerAztecTestnet'
import BannerAztecNodeError from '@/components/BannerAztecNodeError'
initDatadog()

export const metadata: Metadata = {
  title: 'Bridge to Aztec ',
  description: 'Pay and Transact Privately by Bridging to Aztec with human.tech',
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <main className='min-h-screen flex flex-col'>
      <BannerAztecTestnet />
      <BannerAztecNodeError />
      <Header />
      <div className='flex-grow'>
        {/* <div className="py-2"> */}
        {children}
      </div>
      <Footer className='' />
    </main>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const initialState = cookieToInitialState(
    getConfig(),
    typeof window !== 'undefined' ? document.cookie : ''
  )

  return (
    <html lang='en'>
      <body className=''>
        <Providers initialState={initialState}>
          <LayoutContent>{children}</LayoutContent>
        </Providers>
      </body>
    </html>
  )
}
