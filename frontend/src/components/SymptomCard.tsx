'use client'

import React from 'react'

interface SymptomCardProps {
  symptom: { id: string; label: string; icon: string }
  isSelected: boolean
  onToggle: () => void
  delay?: number
}

export default function SymptomCard({ symptom, isSelected, onToggle, delay = 0 }: SymptomCardProps) {
  return (
    <div
      onClick={onToggle}
      className={`sym-card animate-up rounded-2xl p-5 flex flex-col items-center gap-3 select-none cursor-pointer`}
      style={{ animationDelay: `${delay}s` }}
    >
      <span
        className="text-4xl leading-none"
        style={{
          filter: isSelected ? 'drop-shadow(0 0 8px rgba(16,217,138,0.6))' : 'none',
          transform: isSelected ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.2s ease',
        }}
      >
        {symptom.icon}
      </span>
      <span
        className="text-xs font-semibold text-center leading-tight"
        style={{ color: isSelected ? '#10d98a' : '#94a3b8' }}
      >
        {symptom.label}
      </span>
      {isSelected && (
        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )
}
