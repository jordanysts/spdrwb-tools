import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics, trackEvent } from '@/lib/analytics'
import { auth } from '@/auth'

// GET - Retrieve analytics data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)
    const clampedDays = Math.min(Math.max(days, 1), 30)

    const stats = await getAnalytics(clampedDays)

    // Compute summary
    let totalApiCalls = 0
    let totalPageViews = 0
    let totalProviderCalls = 0
    const allUsers = new Set<string>()
    const toolUsage: Record<string, { total: number; users: Record<string, number> }> = {}
    const providerUsage: Record<string, { total: number; users: Record<string, number> }> = {}

    for (const day of stats) {
      totalApiCalls += day.totalApiCalls
      totalPageViews += day.totalPageViews
      totalProviderCalls += (day.totalProviderCalls || 0)
      day.uniqueUsers.forEach(u => allUsers.add(u))

      // Merge API calls
      for (const [path, data] of Object.entries(day.apiCalls)) {
        if (!toolUsage[path]) {
          toolUsage[path] = { total: 0, users: {} }
        }
        toolUsage[path].total += data.total
        for (const [user, count] of Object.entries(data.users)) {
          toolUsage[path].users[user] = (toolUsage[path].users[user] || 0) + count
        }
      }

      // Merge page views into toolUsage for unified view
      for (const [path, data] of Object.entries(day.pageViews)) {
        const key = `page:${path}`
        if (!toolUsage[key]) {
          toolUsage[key] = { total: 0, users: {} }
        }
        toolUsage[key].total += data.total
        for (const [user, count] of Object.entries(data.users)) {
          toolUsage[key].users[user] = (toolUsage[key].users[user] || 0) + count
        }
      }

      // Merge provider calls
      if (day.providerCalls) {
        for (const [provider, data] of Object.entries(day.providerCalls)) {
          if (!providerUsage[provider]) {
            providerUsage[provider] = { total: 0, users: {} }
          }
          providerUsage[provider].total += data.total
          for (const [user, count] of Object.entries(data.users)) {
            providerUsage[provider].users[user] = (providerUsage[provider].users[user] || 0) + count
          }
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalApiCalls,
        totalPageViews,
        totalProviderCalls,
        uniqueUsers: allUsers.size,
        days: clampedDays,
      },
      toolUsage,
      providerUsage,
      dailyStats: stats,
    })
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}

// POST - Track a page view or provider call event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, type: eventType, provider } = body

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    // Get user from server session (not client)
    const session = await auth()
    const userEmail = session?.user?.email || 'anonymous'

    await trackEvent({
      type: eventType || 'page_view',
      path,
      user: userEmail,
      timestamp: new Date().toISOString(),
      provider: provider || undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics track error:', error)
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
  }
}
