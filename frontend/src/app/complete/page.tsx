'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// This route previously rendered hardcoded placeholder transaction data. Until it's
// wired to a real completed transfer, redirect to the bridge so no fake success shows.
export default function CompletePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/?app=1')
  }, [router])
  return null
}
