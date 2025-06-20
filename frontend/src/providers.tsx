'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { type ReactNode, useEffect, useState } from 'react'
import { ToastContainer } from 'react-toastify'
import { useHumanWalletStore } from './stores/humanWalletStore'
import { init as initDatadog } from '@/utils/datadog'

function InitializeHumanWallet() {
  const { initializeHumanWallet } = useHumanWalletStore()

  useEffect(() => {
    initializeHumanWallet()
  }, [initializeHumanWallet])

  return null
}

function InitializeDatadog() {
  useEffect(() => {
    // Initialize Datadog on client-side only
    initDatadog()
  }, [])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient in component to ensure it's created on the client side
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Configuration optimized for stale-while-revalidate pattern
            // staleTime: 1000 * 30, // 30 seconds - shorter stale time to refresh data more frequently
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
            refetchOnWindowFocus: true, // Refetch when window regains focus
            refetchOnReconnect: true, // Refetch when network reconnects
            retry: 2, // Retry failed requests twice
            // retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
            retryDelay: 30000, // 30 seconds

            // placeholderData:true,
            // Add meta flag for queries we want to persist
            meta: {
              persist: false, // default to not persisting
            },
          },
        },
      })
  )

  // Setup persistence on the client side only
  useEffect(() => {
    import('./utils/queryPersistence').then(({ setupQueryPersistence }) => {
      setupQueryPersistence(queryClient)
    })
  }, [queryClient])

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <InitializeHumanWallet />
        <InitializeDatadog />

        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      <ToastContainer toastClassName={'toast-container'} newestOnTop={true} />
    </>
  )
}
