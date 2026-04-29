'use client'

import dynamic from 'next/dynamic'

const Human3DInner = dynamic(() => import('./Human3DInner'), { ssr: false, loading: () => (
  <div style={{ width: '100%', height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,20,45,0.5)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)' }}>
    <div style={{ textAlign: 'center', opacity: 0.4 }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
      <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#10d98a' }}>Loading 3D Engine…</p>
    </div>
  </div>
)})

interface Human3DProps {
  selectedZones: string[]
  onToggleZone: (zone: string) => void
}

export default function Human3D(props: Human3DProps) {
  return <Human3DInner {...props} />
}
