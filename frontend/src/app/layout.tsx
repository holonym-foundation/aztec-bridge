import { Providers } from '@/providers'
import { getConfig } from '@/wagmi'
import type { Metadata } from 'next'
import { cookieToInitialState } from 'wagmi'
import './globals.css'

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
      <body className={``}>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  )
}
