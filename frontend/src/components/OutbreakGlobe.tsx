'use client'

import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Stars } from '@react-three/drei'

export default function OutbreakGlobe() {
  return (
    <div className="w-full h-[400px] bg-slate-950/50 rounded-[3rem] overflow-hidden border border-emerald-500/20 relative">
      <div className="absolute top-6 left-6 z-10">
        <h3 className="text-red-400 font-black tracking-tighter uppercase text-xs">Global Epidemic Surveillance</h3>
        <p className="text-[10px] text-slate-500 font-mono">SCANNING SECTORS...</p>
      </div>

      <Canvas>
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} color="#10b981" />
        
        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          <group>
            {/* The Earth */}
            <Sphere args={[2, 64, 64]}>
              <meshStandardMaterial 
                color="#0f172a" 
                emissive="#064e3b" 
                emissiveIntensity={0.5} 
                wireframe 
              />
            </Sphere>

            {/* Glowing Hotspots */}
            <mesh position={[1.5, 1, 1]}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial color="#ef4444" />
              <pointLight color="#ef4444" intensity={2} distance={3} />
            </mesh>

            <mesh position={[-1, -1.5, 0.5]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshBasicMaterial color="#fbbf24" />
              <pointLight color="#fbbf24" intensity={1} distance={2} />
            </mesh>
          </group>
        </Float>

        <OrbitControls enableZoom={false} autoRotate />
      </Canvas>

      <div className="absolute bottom-6 left-6 z-10 space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <span className="text-[10px] font-bold text-red-400">CRITICAL: SECTOR 87B</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full" />
          <span className="text-[10px] font-bold text-amber-400">WARNING: SECTOR 12A</span>
        </div>
      </div>
    </div>
  )
}
