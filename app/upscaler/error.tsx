'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, RotateCcw } from 'lucide-react'

export default function UpscalerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Upscaler error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="p-2 hover:bg-white rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Image Upscaler</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-2">
            The upscaler encountered an error while loading.
          </p>
          <p className="text-xs text-gray-400 font-mono mb-6 break-all">
            {error.message || 'Unknown error'}
            {error.digest && ` (digest: ${error.digest})`}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}