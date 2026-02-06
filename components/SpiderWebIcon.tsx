import React from 'react'

interface SpiderWebIconProps {
  size?: number
  className?: string
}

export default function SpiderWebIcon({ size = 24, className = '' }: SpiderWebIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Center point */}
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      
      {/* Radial lines */}
      <line x1="12" y1="12" x2="12" y2="2" />
      <line x1="12" y1="12" x2="20.5" y2="7" />
      <line x1="12" y1="12" x2="20.5" y2="17" />
      <line x1="12" y1="12" x2="12" y2="22" />
      <line x1="12" y1="12" x2="3.5" y2="17" />
      <line x1="12" y1="12" x2="3.5" y2="7" />
      
      {/* Inner web ring */}
      <path d="M12 5 L16 6.5 L18 10 L18 14 L16 17.5 L12 19 L8 17.5 L6 14 L6 10 L8 6.5 Z" />
      
      {/* Outer web ring */}
      <path d="M12 2 L20.5 7 L20.5 17 L12 22 L3.5 17 L3.5 7 Z" />
    </svg>
  )
}
