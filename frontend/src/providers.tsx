'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { type ReactNode } from 'react'
import { ToastContainer } from 'react-toastify'
import { WagmiProvider } from 'wagmi'
import { config } from './wagmi'
const queryClient = new QueryClient()

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: any
}) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      <ToastContainer />
    </WagmiProvider>
  )
}
