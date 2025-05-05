import { Providers } from '@/providers'
import { getConfig } from '@/wagmi'
import type { Metadata } from 'next'
import { cookieToInitialState } from 'wagmi'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Human Bridge',
  description: 'Human Bridge',
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
          <main className="min-h-screen flex flex-col">
            <Header 
              // credentials="Credentials"
              // privatePayments="Private Payments"
            />
            <div className="flex-grow">
              {children}
            </div>
            <Footer className="py-6" />
          </main>
        </Providers>
      </body>
    </html>
  )
}
