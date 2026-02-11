import { put, list } from '@vercel/blob'

export interface AnalyticsEvent {
  type: 'api_call' | 'page_view' | 'provider_call'
  path: string
  user: string
  timestamp: string
  provider?: string // e.g. 'google', 'replicate', 'fal', 'runway', 'elevenlabs'
}

export interface DailyStats {
  date: string
  apiCalls: Record<string, { total: number; users: Record<string, number> }>
  pageViews: Record<string, { total: number; users: Record<string, number> }>
  providerCalls: Record<string, { total: number; users: Record<string, number> }>
  totalApiCalls: number
  totalPageViews: number
  totalProviderCalls: number
  uniqueUsers: string[]
}

function getDateKey(): string {
  return new Date().toISOString().split('T')[0] // e.g. "2026-02-11"
}

function getBlobName(date: string): string {
  return `analytics/${date}.json`
}

async function loadDailyStats(date: string): Promise<DailyStats> {
  const empty: DailyStats = {
    date,
    apiCalls: {},
    pageViews: {},
    providerCalls: {},
    totalApiCalls: 0,
    totalPageViews: 0,
    totalProviderCalls: 0,
    uniqueUsers: [],
  }

  try {
    const { blobs } = await list({ prefix: getBlobName(date) })
    if (blobs.length === 0) return empty

    const response = await fetch(blobs[0].url)
    if (!response.ok) return empty
    const data = await response.json()
    return data as DailyStats
  } catch {
    return empty
  }
}

async function saveDailyStats(stats: DailyStats): Promise<void> {
  const blobName = getBlobName(stats.date)

  // Clean up old blob
  try {
    const { blobs } = await list({ prefix: blobName })
    // We'll overwrite with the same name using addRandomSuffix: false
    // Old blobs with random suffix need manual cleanup
    if (blobs.length > 1) {
      const { del } = await import('@vercel/blob')
      for (let i = 1; i < blobs.length; i++) {
        await del(blobs[i].url)
      }
    }
  } catch {
    // Ignore cleanup errors
  }

  await put(blobName, JSON.stringify(stats), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

/**
 * Track an analytics event (fire-and-forget, non-blocking)
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const date = getDateKey()
    const stats = await loadDailyStats(date)

    // Determine which bucket to use
    let bucket: Record<string, { total: number; users: Record<string, number> }>
    if (event.type === 'provider_call') {
      if (!stats.providerCalls) stats.providerCalls = {}
      bucket = stats.providerCalls
    } else if (event.type === 'api_call') {
      bucket = stats.apiCalls
    } else {
      bucket = stats.pageViews
    }

    // For provider calls, use provider name as the key
    const path = event.type === 'provider_call' && event.provider
      ? event.provider
      : event.path

    if (!bucket[path]) {
      bucket[path] = { total: 0, users: {} }
    }

    bucket[path].total++
    bucket[path].users[event.user] = (bucket[path].users[event.user] || 0) + 1

    if (event.type === 'provider_call') {
      if (!stats.totalProviderCalls) stats.totalProviderCalls = 0
      stats.totalProviderCalls++
    } else if (event.type === 'api_call') {
      stats.totalApiCalls++
    } else {
      stats.totalPageViews++
    }

    if (!stats.uniqueUsers.includes(event.user)) {
      stats.uniqueUsers.push(event.user)
    }

    await saveDailyStats(stats)
  } catch (error) {
    console.error('Analytics tracking error:', error)
    // Silently fail - analytics should never break the app
  }
}

/**
 * Get analytics data for a date range
 */
export async function getAnalytics(days: number = 7): Promise<DailyStats[]> {
  const results: DailyStats[] = []

  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    const stats = await loadDailyStats(dateKey)
    if (stats.totalApiCalls > 0 || stats.totalPageViews > 0 || (stats.totalProviderCalls || 0) > 0) {
      results.push(stats)
    }
  }

  return results
}