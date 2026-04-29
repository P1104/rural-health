'use client'

import React, { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Float } from '@react-three/drei'
import * as THREE from 'three'

const BODY_PARTS = [
  { id: 'Head',      position: [0, 2.1, 0]  as [number,number,number], scale: [0.65, 0.65, 0.65] as [number,number,number] },
  { id: 'Chest',     position: [0, 1.0, 0]  as [number,number,number], scale: [1.2, 1.0, 0.7]   as [number,number,number] },
  { id: 'Stomach',   position: [0, 0.0, 0]  as [number,number,number], scale: [1.1, 0.7, 0.65]  as [number,number,number] },
  { id: 'Right Arm', position: [0.95, 0.9, 0] as [number,number,number], scale: [0.38, 1.3, 0.38] as [number,number,number] },
  { id: 'Left Arm',  position: [-0.95, 0.9, 0] as [number,number,number], scale: [0.38, 1.3, 0.38] as [number,number,number] },
  { id: 'Right Leg', position: [0.38, -1.1, 0] as [number,number,number], scale: [0.45, 1.4, 0.45] as [number,number,number] },
  { id: 'Left Leg',  position: [-0.38, -1.1, 0] as [number,number,number], scale: [0.45, 1.4, 0.45] as [number,number,number] },
]

function BodyPart({ id, position, scale, isSelected, onToggle }: {
  id: string; position: [number,number,number]; scale: [number,number,number]; isSelected: boolean; onToggle: (id: string) => void
}) {
  const mesh = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  useFrame((_, delta) => {
    if (mesh.current && isSelected) {
      mesh.current.rotation.y += delta * 0.5
    }
  })

  return (
    <mesh
      ref={mesh}
      position={position}
      scale={scale}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => onToggle(id)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={isSelected ? '#10d98a' : hovered ? '#1e4d6b' : '#0f2744'}
        emissive={isSelected ? '#059669' : hovered ? '#10d98a' : '#000000'}
        emissiveIntensity={isSelected ? 0.5 : hovered ? 0.15 : 0}
        roughness={0.3}
        metalness={0.7}
        transparent
        opacity={isSelected ? 1 : 0.85}
      />
    </mesh>
  )
}

interface Human3DInnerProps {
  selectedZones: string[]
  onToggleZone: (zone: string) => void
}

export default function Human3DInner({ selectedZones, onToggleZone }: Human3DInnerProps) {
  return (
    <div style={{ width: '100%', height: 420, background: 'rgba(5,14,26,0.8)', borderRadius: 24, border: '1px solid rgba(16,217,138,0.15)', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 10 }}>
        <p style={{ fontSize: 9, fontWeight: 800, color: '#10d98a', letterSpacing: '0.1em', fontFamily: 'monospace', textTransform: 'uppercase' }}>3D Biometric Map</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {selectedZones.map(z => (
            <span key={z} style={{ fontSize: 9, background: 'rgba(16,217,138,0.15)', color: '#10d98a', border: '1px solid rgba(16,217,138,0.3)', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>
              {z}
            </span>
          ))}
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 7], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#10d98a" />
        <pointLight position={[-5, -5, 5]} intensity={0.8} color="#3b82f6" />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.8} />
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <group>
            {BODY_PARTS.map(p => (
              <BodyPart
                key={p.id}
                id={p.id}
                position={p.position}
                scale={p.scale}
                isSelected={selectedZones.includes(p.id)}
                onToggle={onToggleZone}
              />
            ))}
          </group>
        </Float>
      </Canvas>

      <p style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#334155', letterSpacing: '0.04em' }}>
        Click any body part • Drag to rotate
      </p>
    </div>
  )
}
