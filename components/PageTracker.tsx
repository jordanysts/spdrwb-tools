'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function PageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // Skip tracking for analytics page to reduce noise
    if (pathname === '/analytics') return

    // Fire-and-forget page view tracking
    fetch('/api/tools/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {}) // Silently ignore failures
  }, [pathname])

  return null
}