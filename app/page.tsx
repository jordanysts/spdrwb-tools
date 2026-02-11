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

export default function HomePage() {
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

        <div className="mt-20 flex flex-col items-center justify-center gap-4">
          <img src="/jordanyspin.gif" alt="System" className="w-12 h-12 rounded-full" />
          <p className="text-xs text-gray-400 font-mono">any feedback or suggestions, pls slack me</p>
        </div>
      </main>
    </div>
  )
}
