'use client'

import ClientLayout from '@/components/ClientLayout'
import AppLoadingScreen from '@/components/AppLoadingScreen'
import { Providers } from '@/providers'
import { useEffect, useState } from 'react'
import './globals.css'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Inject Iris chat widget — Script component doesn't work in Client Components
    const s = document.createElement('script')
    s.src = 'https://iris-v2-fqgd.onrender.com/widget/iris-widget.js'
    s.async = true
    s.setAttribute('data-iris-key', 'shield')
    document.body.appendChild(s)
  }, [])

  // Don't render anything on the server
  if (!mounted) {
    return (
      <html lang="en">
        <head>
          <title>Shield | Private Transactions via Aztec</title>
          <meta name="description" content="Move your funds between Ethereum and Aztec with privacy. Shield is human.tech's programmable privacy bridge." />
        </head>
        <body className="">
          <AppLoadingScreen />
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>
        <title>Shield | Private Transactions via Aztec</title>
        <meta name="description" content="Move your funds between Ethereum and Aztec with privacy. Shield is human.tech's programmable privacy bridge." />
      </head>
      <body className="">
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  )
}
