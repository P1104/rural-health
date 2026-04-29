'use client'

import React, { useState } from 'react'

const ZONES = [
  { id: 'Head',       label: 'Head',       labelPos: [100, 30],  path: 'M100,8 C114,8 124,16 124,28 C124,40 114,50 100,50 C86,50 76,40 76,28 C76,16 86,8 100,8Z' },
  { id: 'Chest',      label: 'Chest',      labelPos: [100, 80],  path: 'M76,52 L124,52 L128,102 L72,102 Z' },
  { id: 'Stomach',    label: 'Stomach',    labelPos: [100, 122], path: 'M72,104 L128,104 L124,140 L76,140 Z' },
  { id: 'Right Arm',  label: 'Right Arm',  labelPos: [148, 90],  path: 'M128,54 L158,60 L152,120 L124,112 Z' },
  { id: 'Left Arm',   label: 'Left Arm',   labelPos: [52, 90],   path: 'M72,54 L42,60 L48,120 L76,112 Z' },
  { id: 'Right Leg',  label: 'Right Leg',  labelPos: [112, 175], path: 'M100,142 L124,142 L126,200 L102,200 Z' },
  { id: 'Left Leg',   label: 'Left Leg',   labelPos: [88, 175],  path: 'M100,142 L76,142 L74,200 L98,200 Z' },
]

interface BodyMapProps {
  selectedZones: string[]
  onToggleZone: (zone: string) => void
}

export default function BodyMap({ selectedZones, onToggleZone }: BodyMapProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-center gap-6">
      {/* SVG Body Map */}
      <div className="relative">
        <svg
          viewBox="0 0 200 212"
          className="w-52 h-64 drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 0 20px rgba(16,217,138,0.05))' }}
        >
          <defs>
            <radialGradient id="selectedGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(16,217,138,0.35)" />
              <stop offset="100%" stopColor="rgba(6,78,59,0.8)" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {ZONES.map((zone) => {
            const isSelected = selectedZones.includes(zone.id)
            const isHovered = hoveredZone === zone.id
            return (
              <g
                key={zone.id}
                className="zone"
                onClick={() => onToggleZone(zone.id)}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
              >
                <path
                  d={zone.path}
                  fill={isSelected ? 'url(#selectedGrad)' : isHovered ? 'rgba(16,217,138,0.18)' : 'rgba(30,58,95,0.8)'}
                  stroke={isSelected ? '#10d98a' : isHovered ? 'rgba(16,217,138,0.5)' : 'rgba(45,90,142,0.6)'}
                  strokeWidth={isSelected ? 1.5 : 1}
                  style={{
                    transition: 'all 0.25s ease',
                    filter: isSelected ? 'url(#glow)' : 'none',
                  }}
                />
                {isSelected && (
                  <path
                    d={zone.path}
                    fill="none"
                    stroke="#10d98a"
                    strokeWidth="1"
                    opacity="0.6"
                    strokeDasharray="3 2"
                  />
                )}
              </g>
            )
          })}

          {/* Neck connector */}
          <rect x="92" y="50" width="16" height="4" fill="rgba(30,58,95,0.8)" stroke="rgba(45,90,142,0.5)" strokeWidth="0.5" />
        </svg>

        {/* Floating zone labels */}
        {selectedZones.map(zoneId => {
          const zone = ZONES.find(z => z.id === zoneId)
          if (!zone) return null
          return (
            <div
              key={zoneId}
              className="absolute pointer-events-none"
              style={{
                top: `${(zone.labelPos[1] / 212) * 100}%`,
                left: `${(zone.labelPos[0] / 200) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="text-[10px] font-bold text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                {zone.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Instructions */}
      <p className="text-slate-400 text-sm text-center">
        {selectedZones.length === 0
          ? 'Tap where it hurts'
          : `${selectedZones.length} area${selectedZones.length > 1 ? 's' : ''} selected`
        }
      </p>
    </div>
  )
}
