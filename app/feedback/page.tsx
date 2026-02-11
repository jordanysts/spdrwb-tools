'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeft,
  Bug,
  Lightbulb,
  TrendingUp,
  HelpCircle,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Trash2,
  MessageSquare,
  Filter,
  Plus,
} from 'lucide-react'

interface FeedbackItem {
  id: string
  type: 'bug' | 'feature' | 'improvement' | 'other'
  title: string
  description: string
  tool: string
  submittedBy: string
  status: 'new' | 'in-progress' | 'done' | 'dismissed'
  adminNote: string
  createdAt: string
  updatedAt: string
}

const typeConfig = {
  bug: { label: 'Bug', icon: Bug, color: 'text-red-600', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700' },
  feature: { label: 'Feature Request', icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  improvement: { label: 'Improvement', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  other: { label: 'Other', icon: HelpCircle, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-700' },
}

const statusConfig = {
  new: { label: 'New', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  'in-progress': { label: 'In Progress', icon: Loader2, color: 'text-orange-600', bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  dismissed: { label: 'Dismissed', icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
}

const statusOrder: FeedbackItem['status'][] = ['new', 'in-progress', 'done', 'dismissed']

export default function FeedbackBoardPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitForm, setSubmitForm] = useState({
    type: 'feature' as FeedbackItem['type'],
    title: '',
    description: '',
    tool: 'General',
  })

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch('/api/tools/feedback')
      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch feedback:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const updateStatus = async (id: string, status: FeedbackItem['status']) => {
    try {
      const res = await fetch('/api/tools/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setItems(prev =>
          prev.map(item => (item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item))
        )
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const saveNote = async (id: string) => {
    try {
      const res = await fetch('/api/tools/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, adminNote: noteText }),
      })
      if (res.ok) {
        setItems(prev =>
          prev.map(item =>
            item.id === id ? { ...item, adminNote: noteText, updatedAt: new Date().toISOString() } : item
          )
        )
        setEditingNote(null)
        setNoteText('')
      }
    } catch (err) {
      console.error('Failed to save note:', err)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Delete this feedback item?')) return
    try {
      const res = await fetch(`/api/tools/feedback?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id))
        if (expandedItem === id) setExpandedItem(null)
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleSubmit = async () => {
    if (!submitForm.title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tools/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitForm),
      })
      if (res.ok) {
        const data = await res.json()
        setItems(prev => [data.item, ...prev])
        setShowSubmitModal(false)
        setSubmitForm({ type: 'feature', title: '', description: '', tool: 'General' })
      }
    } catch (err) {
      console.error('Failed to submit:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false
    if (filterType !== 'all' && item.type !== filterType) return false
    return true
  })

  const counts = {
    all: items.length,
    new: items.filter(i => i.status === 'new').length,
    'in-progress': items.filter(i => i.status === 'in-progress').length,
    done: items.filter(i => i.status === 'done').length,
    dismissed: items.filter(i => i.status === 'dismissed').length,
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="w-full bg-black py-6 px-4 mb-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Feedback Board
            </h1>
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit Request
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', ...statusOrder] as const).map((status) => {
            const isActive = filterStatus === status
            const config = status !== 'all' ? statusConfig[status] : null
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {config && <span className={`w-2 h-2 rounded-full ${config.dot}`} />}
                {status === 'all' ? 'All' : config?.label}
                <span className={`text-xs ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                  {counts[status]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="bug">🐛 Bug</option>
            <option value="feature">💡 Feature Request</option>
            <option value="improvement">📈 Improvement</option>
            <option value="other">❓ Other</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No feedback yet</p>
            <p className="text-gray-400 text-sm mb-6">
              {filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Be the first to submit a request!'}
            </p>
            <button
              onClick={() => setShowSubmitModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Submit Request
            </button>
          </div>
        )}

        {/* Feedback Items */}
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((item) => {
              const tc = typeConfig[item.type]
              const sc = statusConfig[item.status]
              const TypeIcon = tc.icon
              const isExpanded = expandedItem === item.id

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`border rounded-xl overflow-hidden transition-all ${
                    isExpanded ? 'border-gray-300 shadow-md' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Item Header */}
                  <button
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    className="w-full flex items-start gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${tc.bg} border mt-0.5`}>
                      <TypeIcon className={`w-4 h-4 ${tc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tc.badge}`}>
                          {tc.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg}`}>
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{item.tool}</span>
                        <span>•</span>
                        <span>{item.submittedBy}</span>
                        <span>•</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform mt-1 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="border-t border-gray-100 bg-gray-50 px-4 py-4"
                    >
                      {/* Description */}
                      {item.description && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.description}</p>
                        </div>
                      )}

                      {/* Status Controls */}
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Update Status</p>
                        <div className="flex flex-wrap gap-2">
                          {statusOrder.map((s) => {
                            const cfg = statusConfig[s]
                            const isCurrentStatus = item.status === s
                            return (
                              <button
                                key={s}
                                onClick={() => updateStatus(item.id, s)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  isCurrentStatus
                                    ? 'bg-black text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isCurrentStatus ? 'bg-white' : cfg.dot}`} />
                                {cfg.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Admin Note */}
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Admin Note</p>
                        {editingNote === item.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Add a note..."
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveNote(item.id)}
                                className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingNote(null); setNoteText('') }}
                                className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingNote(item.id); setNoteText(item.adminNote || '') }}
                            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            {item.adminNote || 'Click to add a note...'}
                          </button>
                        )}
                      </div>

                      {/* Delete */}
                      <div className="flex justify-end pt-2 border-t border-gray-200">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* Submit Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSubmitModal(false) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-xl"
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Submit Feedback</h2>
                <p className="text-sm text-gray-500 mb-6">Request a feature, report a bug, or suggest improvements.</p>

                <div className="space-y-4">
                  {/* Type */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Type</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.entries(typeConfig) as [FeedbackItem['type'], typeof typeConfig.bug][]).map(([key, cfg]) => {
                        const Icon = cfg.icon
                        return (
                          <button
                            key={key}
                            onClick={() => setSubmitForm(prev => ({ ...prev, type: key }))}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                              submitForm.type === key
                                ? 'border-black bg-gray-50 text-gray-900'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${submitForm.type === key ? cfg.color : ''}`} />
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Title *</label>
                    <input
                      type="text"
                      value={submitForm.title}
                      onChange={(e) => setSubmitForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief summary of your request..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>

                  {/* Tool */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Related Tool</label>
                    <select
                      value={submitForm.tool}
                      onChange={(e) => setSubmitForm(prev => ({ ...prev, tool: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="General">General</option>
                      <option value="AI Image Generator">AI Image Generator</option>
                      <option value="Expression Editor">Expression Editor</option>
                      <option value="AI Image Editor">AI Image Editor</option>
                      <option value="Image Resizer">Image Resizer</option>
                      <option value="Image Upscaler">Image Upscaler</option>
                      <option value="AI Video Tool">AI Video Tool</option>
                      <option value="Audio Generator">Audio Generator</option>
                      <option value="Audio Editor">Audio Editor</option>
                      <option value="Snap AR Camera Kit">Snap AR Camera Kit</option>
                      <option value="WebAR Hub">WebAR Hub</option>
                      <option value="Subtropic Photobooth">Subtropic Photobooth</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Description</label>
                    <textarea
                      value={submitForm.description}
                      onChange={(e) => setSubmitForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your request in detail (optional)..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!submitForm.title.trim() || submitting}
                  className="px-5 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}