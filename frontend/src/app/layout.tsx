import ClientLayout from '@/components/ClientLayout'
import { Providers } from '@/providers'
import { init as initDatadog } from '@/utils/datadog'
import { getConfig } from '@/wagmi'
import type { Metadata } from 'next'
import { cookieToInitialState } from 'wagmi'
import './globals.css'

initDatadog()

export const metadata: Metadata = {
  title: 'Bridge to Aztec ',
  description: 'Pay and Transact Privately by Bridging to Aztec with human.tech',
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
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  )
}
