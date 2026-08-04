import type { Metadata } from 'next'
import ClientLayout from '@/components/ClientLayout'
import { Providers } from '@/providers'
import './globals.css'

const SITE_URL = 'https://shield.human.tech'

const DESCRIPTION =
  "Move your funds between Ethereum and Aztec with privacy. Shield is human.tech's accountable privacy bridge."

// Server component: every route ships real <head> metadata (and the /docs routes ship
// full content) to search engines and non-JS agents. The wallet/providers, the
// client-only loading gate, and the Iris chat widget all live in the child (Providers +
// ClientLayout → IrisWidget). The canonical URL exists so Google consolidates the stale
// bridge.human.tech index onto this origin.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Shield | Private Transactions via Aztec',
    template: '%s | Shield',
  },
  description: DESCRIPTION,
  applicationName: 'Shield',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Shield',
    url: SITE_URL,
    title: 'Shield | Private Transactions via Aztec',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shield | Private Transactions via Aztec',
    description: DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="">
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  )
}
