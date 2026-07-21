'use client'

import ClientLayout from '@/components/ClientLayout'
import AppLoadingScreen from '@/components/AppLoadingScreen'
import { Providers } from '@/providers'
import type { Metadata } from 'next'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import './globals.css'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  // Docs are a clean, self-contained reading surface with their own header nav.
  // The third-party Iris widget loads its UI (and its icon glyphs) from a remote
  // origin; when that fetch is slow or blocked those glyphs render as broken
  // dash/tofu placeholders. Keep it off the docs pages.
  const isDocs = pathname?.startsWith('/docs') ?? false

  useEffect(() => {
    setMounted(true)
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
        {!isDocs && (
          <Script
            src="https://iris-v2-fqgd.onrender.com/widget/iris-widget.js"
            strategy="afterInteractive"
            data-iris-key="shield"
          />
        )}
      </body>
    </html>
  )
}
