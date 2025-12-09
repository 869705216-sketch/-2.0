import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, PerspectiveCamera, ContactShadows, Stars, Sparkles, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { Tree } from './Tree';
import { HandData } from '../types';
import * as THREE from 'three';

interface ExperienceProps {
  handData: HandData;
}

const CameraController: React.FC<{ handData: HandData }> = ({ handData }) => {
    // Cinematic movement based on hand
    useFrame((state) => {
        // Base position [0, 4, 20]
        const baseX = 0;
        const baseY = 4;
        const baseZ = 20;

        const targetX = baseX + (handData.x * -5); // Pan left/right
        const targetY = baseY + (handData.y * 3);  // Pan up/down
        
        state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.05);
        state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.05);
        state.camera.lookAt(0, 1, 0); // Look slightly up at the tree center
    });
    return null;
};

export const Experience: React.FC<ExperienceProps> = ({ handData }) => {
  return (
    <Canvas 
        shadows 
        dpr={[1, 2]} 
        gl={{ 
            antialias: false, 
            toneMapping: THREE.ReinhardToneMapping, 
            toneMappingExposure: 1.2,
            stencil: false,
            depth: true
        }}
    >
      <PerspectiveCamera makeDefault position={[0, 4, 20]} fov={45} />
      <CameraController handData={handData} />

      {/* --- Environment & Lighting --- */}
      {/* Luxury Interior Lighting */}
      <Environment preset="lobby" background={false} blur={0.6} />
      
      {/* Increased ambient for better visibility in dark areas */}
      <ambientLight intensity={0.8} color="#002211" />
      
      {/* Main Spotlight for Gold Highlights */}
      <spotLight 
        position={[10, 15, 10]} 
        angle={0.3} 
        penumbra={1} 
        intensity={2.5} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        color="#fff0d0"
      />
      
      {/* Rim Light for separation from dark background */}
      <spotLight position={[-10, 5, -5]} intensity={8} color="#00ff88" angle={0.5} />
      
      {/* Fill Light */}
      <pointLight position={[0, 2, 10]} intensity={0.5} color="#ffaa00" />

      {/* --- Atmosphere --- */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
      {/* Increased sparkles to fill the void */}
      <Sparkles count={800} scale={30} size={6} speed={0.2} opacity={0.4} color="#FFD700" />

      {/* --- Floor --- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5.5, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          {/* Reflective floor to fill the bottom black void with light */}
          <MeshReflectorMaterial
            blur={[400, 100]}
            resolution={1024}
            mixBlur={1}
            mixStrength={25} // Strength of the reflection
            roughness={0.5}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#050a07" // Deep rich green-black
            metalness={0.8}
            mirror={0.7}
          />
      </mesh>
      
      {/* Contact shadows for grounding */}
      <ContactShadows resolution={1024} scale={30} blur={2.5} opacity={0.5} color="#000000" />

      {/* --- Content --- */}
      <Tree handData={handData} />

      {/* --- Post Processing --- */}
      <EffectComposer disableNormalPass>
        {/* Intense Golden Glow */}
        <Bloom 
            luminanceThreshold={0.85} 
            mipmapBlur 
            intensity={1.0} 
            radius={0.6} 
            levels={8} 
        />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.05} darkness={0.8} />
      </EffectComposer>
      
      {/* Deep Rich Emerald-Black Background instead of pure black */}
      <color attach="background" args={['#010502']} />
      <fog attach="fog" args={['#010502', 12, 45]} />
    </Canvas>
  );
};