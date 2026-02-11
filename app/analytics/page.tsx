'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  Users,
  Zap,
  Eye,
  Loader2,
  Calendar,
  TrendingUp,
  Cloud,
} from 'lucide-react'

interface ToolUsageEntry {
  total: number
  users: Record<string, number>
}

interface DailyStats {
  date: string
  apiCalls: Record<string, ToolUsageEntry>
  pageViews: Record<string, ToolUsageEntry>
  totalApiCalls: number
  totalPageViews: number
  uniqueUsers: string[]
}

interface AnalyticsData {
  summary: {
    totalApiCalls: number
    totalPageViews: number
    totalProviderCalls: number
    uniqueUsers: number
    days: number
  }
  toolUsage: Record<string, ToolUsageEntry>
  providerUsage: Record<string, ToolUsageEntry>
  dailyStats: DailyStats[]
}

// Friendly names for providers
const providerNames: Record<string, string> = {
  'google': 'Google Gemini',
  'google-veo': 'Google Veo',
  'replicate': 'Replicate (SeeDream)',
  'bfl': 'Black Forest Labs (Flux)',
  'runway': 'Runway',
  'elevenlabs': 'ElevenLabs',
  'fal': 'FAL.ai',
}

const providerColors: Record<string, string> = {
  'google': 'bg-blue-500',
  'google-veo': 'bg-red-500',
  'replicate': 'bg-purple-500',
  'bfl': 'bg-amber-500',
  'runway': 'bg-teal-500',
  'elevenlabs': 'bg-pink-500',
  'fal': 'bg-indigo-500',
}

// Friendly names for API routes
const routeNames: Record<string, string> = {
  '/api/tools/image': 'AI Image Editor',
  '/api/tools/runway': 'Runway Video',
  '/api/tools/veo': 'Google Veo Video',
  '/api/tools/chat': 'Chat',
  '/api/tools/upscaler': 'Image Upscaler',
  '/api/tools/expression-editor': 'Expression Editor',
  '/api/tools/composite': 'Image Composite',
  '/api/tools/tinypng': 'TinyPNG Compress',
  '/api/tools/feedback': 'Feedback',
  '/api/tools/analytics': 'Analytics',
}

const pageNames: Record<string, string> = {
  'page:/': 'Home',
  'page:/image-generator': 'Image Generator',
  'page:/expression-editor': 'Expression Editor',
  'page:/image': 'AI Image Editor',
  'page:/resizer': 'Image Resizer',
  'page:/upscaler': 'Image Upscaler',
  'page:/videogen': 'Video Generator',
  'page:/audio-gen': 'Audio Generator',
  'page:/audio': 'Audio Editor',
  'page:/snap-camerakit': 'Snap Camera Kit',
  'page:/webarhub': 'WebAR Hub',
  'page:/stspb': 'Subtropic Photobooth',
  'page:/feedback': 'Feedback Board',
  'page:/analytics': 'Analytics',
}

function getFriendlyName(key: string): string {
  return routeNames[key] || pageNames[key] || key.replace('page:', '').replace('/api/tools/', '')
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const [activeTab, setActiveTab] = useState<'providers' | 'api' | 'pages' | 'users'>('providers')

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tools/analytics?days=${days}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Provider entries
  const providerEntries = data
    ? Object.entries(data.providerUsage || {}).sort((a, b) => b[1].total - a[1].total)
    : []

  const maxProviderCount = providerEntries.length > 0 ? providerEntries[0][1].total : 1

  // Split tool usage into API calls and page views
  const apiEntries = data
    ? Object.entries(data.toolUsage)
        .filter(([key]) => !key.startsWith('page:'))
        .sort((a, b) => b[1].total - a[1].total)
    : []

  const pageEntries = data
    ? Object.entries(data.toolUsage)
        .filter(([key]) => key.startsWith('page:'))
        .sort((a, b) => b[1].total - a[1].total)
    : []

  // Compute per-user totals
  const userTotals: Record<string, { apiCalls: number; pageViews: number }> = {}
  if (data) {
    for (const [key, entry] of Object.entries(data.toolUsage)) {
      const isPage = key.startsWith('page:')
      for (const [user, count] of Object.entries(entry.users)) {
        if (!userTotals[user]) userTotals[user] = { apiCalls: 0, pageViews: 0 }
        if (isPage) {
          userTotals[user].pageViews += count
        } else {
          userTotals[user].apiCalls += count
        }
      }
    }
  }

  const userEntries = Object.entries(userTotals).sort(
    (a, b) => (b[1].apiCalls + b[1].pageViews) - (a[1].apiCalls + a[1].pageViews)
  )

  const maxApiCount = apiEntries.length > 0 ? apiEntries[0][1].total : 1
  const maxPageCount = pageEntries.length > 0 ? pageEntries[0][1].total : 1

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="w-full bg-black py-6 px-4 mb-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-white" />
              <h1 className="text-2xl font-bold text-white tracking-wide">
                Analytics
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Cloud className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Provider Calls</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{(data.summary.totalProviderCalls || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Last {data.summary.days} day{data.summary.days > 1 ? 's' : ''}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">API Calls</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.summary.totalApiCalls.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Last {data.summary.days} day{data.summary.days > 1 ? 's' : ''}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Eye className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Page Views</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.summary.totalPageViews.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Last {data.summary.days} day{data.summary.days > 1 ? 's' : ''}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unique Users</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.summary.uniqueUsers}</p>
                <p className="text-xs text-gray-400 mt-1">Last {data.summary.days} day{data.summary.days > 1 ? 's' : ''}</p>
              </motion.div>
            </div>

            {/* Daily Trend */}
            {data.dailyStats.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Daily Trend</h3>
                </div>
                <div className="flex items-end gap-1 h-32">
                  {[...data.dailyStats].reverse().map((day) => {
                    const maxDay = Math.max(...data.dailyStats.map(d => d.totalApiCalls + d.totalPageViews), 1)
                    const height = ((day.totalApiCalls + day.totalPageViews) / maxDay) * 100
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-black rounded-t-md transition-all hover:bg-gray-700"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${day.date}: ${day.totalApiCalls} API calls, ${day.totalPageViews} page views`}
                        />
                        <span className="text-[10px] text-gray-400 truncate w-full text-center">
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
              {([
                { key: 'providers' as const, label: 'Providers', count: providerEntries.length },
                { key: 'api' as const, label: 'API Usage', count: apiEntries.length },
                { key: 'pages' as const, label: 'Page Views', count: pageEntries.length },
                { key: 'users' as const, label: 'Users', count: userEntries.length },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs text-gray-400">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Providers Tab */}
            {activeTab === 'providers' && (
              <div className="space-y-3">
                {providerEntries.length === 0 && (
                  <p className="text-center text-gray-400 py-10">No provider calls recorded yet. Use the tools to start tracking.</p>
                )}
                {providerEntries.map(([provider, entry]) => (
                  <div key={provider} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${providerColors[provider] || 'bg-gray-500'}`} />
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{providerNames[provider] || provider}</h4>
                          <p className="text-xs text-gray-400">{provider}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{entry.total.toLocaleString()}</span>
                    </div>
                    {/* Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div
                        className={`${providerColors[provider] || 'bg-gray-500'} rounded-full h-2 transition-all`}
                        style={{ width: `${(entry.total / maxProviderCount) * 100}%` }}
                      />
                    </div>
                    {/* User breakdown */}
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entry.users)
                        .sort((a, b) => b[1] - a[1])
                        .map(([user, count]) => (
                          <span key={user} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                            {user.split('@')[0]} <span className="text-gray-400">({count})</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* API Usage Tab */}
            {activeTab === 'api' && (
              <div className="space-y-3">
                {apiEntries.length === 0 && (
                  <p className="text-center text-gray-400 py-10">No API calls recorded yet</p>
                )}
                {apiEntries.map(([path, entry]) => (
                  <div key={path} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{getFriendlyName(path)}</h4>
                        <p className="text-xs text-gray-400 font-mono">{path}</p>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{entry.total.toLocaleString()}</span>
                    </div>
                    {/* Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div
                        className="bg-black rounded-full h-2 transition-all"
                        style={{ width: `${(entry.total / maxApiCount) * 100}%` }}
                      />
                    </div>
                    {/* User breakdown */}
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entry.users)
                        .sort((a, b) => b[1] - a[1])
                        .map(([user, count]) => (
                          <span key={user} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                            {user.split('@')[0]} <span className="text-gray-400">({count})</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Page Views Tab */}
            {activeTab === 'pages' && (
              <div className="space-y-3">
                {pageEntries.length === 0 && (
                  <p className="text-center text-gray-400 py-10">No page views recorded yet</p>
                )}
                {pageEntries.map(([path, entry]) => (
                  <div key={path} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{getFriendlyName(path)}</h4>
                        <p className="text-xs text-gray-400 font-mono">{path.replace('page:', '')}</p>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{entry.total.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div
                        className="bg-green-500 rounded-full h-2 transition-all"
                        style={{ width: `${(entry.total / maxPageCount) * 100}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entry.users)
                        .sort((a, b) => b[1] - a[1])
                        .map(([user, count]) => (
                          <span key={user} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                            {user.split('@')[0]} <span className="text-gray-400">({count})</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                {userEntries.length === 0 && (
                  <p className="text-center text-gray-400 py-10">No user activity recorded yet</p>
                )}
                {userEntries.map(([user, totals]) => (
                  <div key={user} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm">{user}</h4>
                      <span className="text-sm font-bold text-gray-900">
                        {(totals.apiCalls + totals.pageViews).toLocaleString()} total
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-blue-500" />
                        {totals.apiCalls} API calls
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3 h-3 text-green-500" />
                        {totals.pageViews} page views
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !data && (
          <div className="text-center py-20">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Failed to load analytics data</p>
          </div>
        )}
      </main>
    </div>
  )
}