import ClientLayout from '@/components/ClientLayout'
import { Providers } from '@/providers'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bridge to Aztec ',
  description: 'Pay and Transact Privately by Bridging to Aztec with human.tech',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body className=''>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  )
}
