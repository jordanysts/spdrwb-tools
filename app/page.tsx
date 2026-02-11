'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  Camera,
  Smile,
  Glasses,
  Wand2,
  Maximize,
  Minimize2,
  Music,
  Image as ImageIcon,
  Headphones,
  Sparkles,
  Video,
  Film,
  Palmtree,
  Mic,
  MessageSquarePlus,
  Bug,
  Lightbulb,
  TrendingUp,
  HelpCircle,
  Loader2,
  X,
} from 'lucide-react'

const toolSections = [
  {
    title: 'Image Tools',
    description: 'Edit, enhance, and transform your images with AI',
    icon: ImageIcon,
    tools: [
      {
        name: 'AI Image Generator',
        description: 'Generate Images using latest image models.',
        icon: ImageIcon,
        href: '/image-generator',
      },
      {
        name: 'Expression Editor',
        description: 'Adjust Facial Expressions and Comp together all in one page!',
        icon: Smile,
        href: '/expression-editor',
      },
      {
        name: 'AI Image Editor',
        description: 'Iterative Editing with Nano Banana Pro. Adjust poses, lighting, scene, and more.',
        icon: Wand2,
        href: '/image',
      },
      {
        name: 'Image Resizer',
        description: 'Optimize, Convert, Resize, and Compress images.',
        icon: Minimize2,
        href: '/resizer',
      },
      {
        name: 'Image Upscaler',
        description: 'Enhance image resolution and quality with Topaz AI',
        icon: Maximize,
        href: '/upscaler',
      },
    ],
  },
  {
    title: 'Video Tools',
    description: 'Generate and edit videos with AI',
    icon: Film,
    tools: [
      {
        name: 'AI Video Tool',
        description: 'Generate AI Videos from images using Runway Gen-4 and Google Veo 3',
        icon: Video,
        href: '/videogen',
      },
    ],
  },
  {
    title: 'Audio Tools',
    description: 'Process, convert, and edit audio files',
    icon: Headphones,
    tools: [
      {
        name: 'Audio Generator',
        description: 'Generate Speech, Music, SFX, Voice with ElevenLabs',
        icon: Mic,
        href: '/audio-gen',
      },
      {
        name: 'Audio Editor',
        description: 'Convert, optimize, trim and edit audio files between formats (MP3, WAV)',
        icon: Music,
        href: '/audio',
      },
    ],
  },
  {
    title: 'WebAR Demos',
    description: 'Augmented reality experiences and experiments',
    icon: Sparkles,
    collapsed: true,
    tools: [
      {
        name: 'Snap AR Camera Kit',
        description: 'Experience AR lenses powered by Snap Camera Kit - BBW-Bridgerton!',
        icon: Camera,
        href: '/snap-camerakit',
      },
      {
        name: 'WebAR Hub',
        description: 'Test and experience various WebAR experiments and demos',
        icon: Glasses,
        href: '/webarhub',
      },
      {
        name: 'Subtropic Photobooth',
        description: 'AI photobooth - sunny subtropic beach on the moon',
        icon: Palmtree,
        href: '/stspb',
      },
    ],
  },
]

const typeConfig = {
  bug: { label: 'Bug', icon: Bug, color: 'text-red-600' },
  feature: { label: 'Feature', icon: Lightbulb, color: 'text-amber-600' },
  improvement: { label: 'Improvement', icon: TrendingUp, color: 'text-blue-600' },
  other: { label: 'Other', icon: HelpCircle, color: 'text-gray-600' },
}

const toolOptions = [
  'General',
  'AI Image Generator',
  'Expression Editor',
  'AI Image Editor',
  'Image Resizer',
  'Image Upscaler',
  'AI Video Tool',
  'Audio Generator',
  'Audio Editor',
  'Snap AR Camera Kit',
  'WebAR Hub',
  'Subtropic Photobooth',
]

export default function HomePage() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitForm, setSubmitForm] = useState({
    type: 'feature' as 'bug' | 'feature' | 'improvement' | 'other',
    title: '',
    description: '',
    tool: 'General',
  })

  const handleFeedbackSubmit = async () => {
    if (!submitForm.title.trim()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/tools/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitForm),
      })
      if (res.ok) {
        setSubmitted(true)
        setTimeout(() => {
          setShowFeedbackModal(false)
          setSubmitted(false)
          setSubmitError('')
          setSubmitForm({ type: 'feature', title: '', description: '', tool: 'General' })
        }, 1500)
      } else {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error || `Submit failed (${res.status})`)
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err)
      setSubmitError('Network error - please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    toolSections.forEach(s => {
      initial[s.title] = !(s as any).collapsed;
    });
    return initial;
  });

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Full Width Navbar Header - Black */}
      <div className="w-full bg-black py-6 px-4 mb-4 shadow-sm">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white tracking-wide">
            STS Generative Tools
          </h1>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-1">
            Collection of curated AI tools to optimize workflows and accessibility.
          </p>
        </motion.div>

        <div className="space-y-8 max-w-5xl mx-auto">
          {toolSections.map((section, sectionIndex) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
              className="bg-gray-50 backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-black ring-1 ring-gray-300 shadow-sm">
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                    <p className="text-sm text-gray-500">{section.description}</p>
                  </div>
                </div>
                <div className={`transform transition-transform duration-200 text-gray-400 ${expandedSections[section.title] ? 'rotate-180' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              <div
                className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 px-6 pb-6 transition-all duration-300 ease-in-out ${expandedSections[section.title] ? 'opacity-100' : 'hidden opacity-0'}`}
              >
                {section.tools.map((tool, toolIndex) => (
                  <motion.div
                    key={tool.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sectionIndex * 0.1 + toolIndex * 0.05 }}
                  >
                    <Link
                      href={tool.href}
                      className="card p-5 h-full hover:border-gray-400 hover:shadow-md transition-all block bg-white border border-gray-200 rounded-xl group"
                    >
                      <tool.icon className="w-8 h-8 text-black mb-4 group-hover:scale-110 transition-transform duration-300" />
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg">{tool.name}</h3>
                      <p className="text-sm text-gray-500 mb-4 leading-relaxed">{tool.description}</p>
                      <div className="flex items-center text-black font-medium text-xs mt-auto">
                        Open <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>

        {/* Feedback Section */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-black">
                <MessageSquarePlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Have feedback or a request?</h3>
                <p className="text-sm text-gray-500">Submit feature requests, report bugs, or suggest improvements.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/feedback"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                View Board
              </Link>
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* Feedback Submit Modal */}
      {showFeedbackModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFeedbackModal(false) }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl"
          >
            {submitted ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Submitted!</h3>
                <p className="text-sm text-gray-500">Your feedback has been received.</p>
              </div>
            ) : (
              <>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-bold text-gray-900">Submit Feedback</h2>
                    <button onClick={() => setShowFeedbackModal(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">Request a feature, report a bug, or suggest improvements.</p>

                  <div className="space-y-4">
                    {/* Type */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Type</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(Object.entries(typeConfig) as ['bug' | 'feature' | 'improvement' | 'other', typeof typeConfig.bug][]).map(([key, cfg]) => {
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
                        {toolOptions.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
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

                {/* Error Message */}
                {submitError && (
                  <div className="mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    {submitError}
                  </div>
                )}

                {/* Modal Actions */}
                <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={() => { setShowFeedbackModal(false); setSubmitError('') }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={!submitForm.title.trim() || submitting}
                    className="px-5 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Submit
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
