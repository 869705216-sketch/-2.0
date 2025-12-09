import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { HandState, HandData } from '../types';

// --- Configuration ---
const FOLIAGE_COUNT = 45000;
const ORNAMENT_COUNT = 400;
const GIFT_COUNT = 30;
const LIGHT_COUNT = 500;

// Colors
const COLOR_EMERALD = new THREE.Color("#004225");
const COLOR_GOLD = new THREE.Color("#FFD700");
const COLOR_RUBY = new THREE.Color("#800020");
const COLOR_WARM_WHITE = new THREE.Color("#FFF8E7");

// --- Shaders ---

const foliageVertexShader = `
  uniform float uProgress;
  uniform float uTime;
  attribute vec3 aTargetPos;
  attribute vec3 aChaosPos;
  attribute float aRandom;
  
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vUv = uv;
    
    // Cubic ease out for smooth snap
    float t = uProgress;
    float ease = 1.0 - pow(1.0 - t, 3.0);
    
    // Interpolate position
    vec3 pos = mix(aChaosPos, aTargetPos, ease);
    
    // Add subtle wind sway when formed
    if (uProgress > 0.8) {
      pos.x += sin(uTime * 2.0 + pos.y) * 0.05 * (pos.y * 0.1);
      pos.z += cos(uTime * 1.5 + pos.y) * 0.05 * (pos.y * 0.1);
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size attenuation
    gl_PointSize = (4.0 * aRandom + 2.0) * (20.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // Fade out stray particles slightly
    vAlpha = 0.8 + 0.2 * sin(uTime + aRandom * 10.0);
  }
`;

const foliageFragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    // Circular particle
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Gradient for needle look
    float gradient = 1.0 - (dist * 2.0);
    vec3 finalColor = uColor * (0.5 + 0.5 * gradient);
    
    gl_FragColor = vec4(finalColor, vAlpha);
  }
`;

// --- Math Helpers ---

// Generate points in a Cone (Tree shape)
const getConePoint = (height: number, radiusBase: number, yOffset: number) => {
  const theta = Math.random() * Math.PI * 2;
  const h = Math.random() * height; // Height from bottom
  const r = (radiusBase * (1 - h / height)) * Math.sqrt(Math.random()); // Even distribution
  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  const y = h + yOffset;
  return new THREE.Vector3(x, y, z);
};

// Generate points in a Sphere (Chaos shape)
const getSpherePoint = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius; // Uniform volume
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

// --- Sub-Components ---

const FoliageSystem = ({ handData }: { handData: HandData }) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
  const { positions, chaosPositions, randoms } = useMemo(() => {
    const pos = new Float32Array(FOLIAGE_COUNT * 3);
    const chaos = new Float32Array(FOLIAGE_COUNT * 3);
    const rands = new Float32Array(FOLIAGE_COUNT);

    for (let i = 0; i < FOLIAGE_COUNT; i++) {
      // Formed: Cone
      const target = getConePoint(12, 4.5, -5);
      pos[i * 3] = target.x;
      pos[i * 3 + 1] = target.y;
      pos[i * 3 + 2] = target.z;

      // Chaos: Large Sphere
      const sphere = getSpherePoint(15);
      chaos[i * 3] = sphere.x;
      chaos[i * 3 + 1] = sphere.y;
      chaos[i * 3 + 2] = sphere.z;

      rands[i] = Math.random();
    }
    return { positions: pos, chaosPositions: chaos, randoms: rands };
  }, []);

  // Logic: 0 = Chaos, 1 = Formed
  // Hand Open = Unleash (Go to Chaos/0)
  // Hand Closed = Form (Go to Formed/1)
  const targetProgress = useRef(1);
  const currentProgress = useRef(1);

  useFrame((state, delta) => {
    if (!shaderRef.current) return;

    // Determine target based on hand
    targetProgress.current = handData.state === HandState.OPEN ? 0 : 1;

    // Smooth Lerp
    // Unleash fast, reform slow and majestic
    const speed = handData.state === HandState.OPEN ? 2.5 : 1.0;
    currentProgress.current = THREE.MathUtils.lerp(currentProgress.current, targetProgress.current, delta * speed);

    shaderRef.current.uniforms.uProgress.value = currentProgress.current;
    shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aChaosPos" count={chaosPositions.length / 3} array={chaosPositions} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={randoms.length} array={randoms} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        vertexShader={foliageVertexShader}
        fragmentShader={foliageFragmentShader}
        uniforms={{
          uProgress: { value: 1 },
          uTime: { value: 0 },
          uColor: { value: COLOR_EMERALD },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Generic Instanced Component for Objects (Baubles, Gifts, Lights)
const InstancedDecor = ({ 
  count, 
  geometry, 
  material, 
  scaleBase, 
  chaosRadius, 
  weight,
  handData,
  type
}: any) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      // Target Position (Cone or Base for gifts)
      let target;
      if (type === 'gift') {
        // Pile at bottom
        const r = Math.random() * 5;
        const theta = Math.random() * Math.PI * 2;
        target = new THREE.Vector3(r * Math.cos(theta), -5 + Math.random(), r * Math.sin(theta));
      } else {
        // Tree Cone
        target = getConePoint(11, 4.2, -4.8);
      }
      
      // Chaos Position
      const chaos = getSpherePoint(chaosRadius);

      return {
        target,
        chaos,
        scale: scaleBase * (0.8 + Math.random() * 0.4),
        rotation: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, 0),
        chaosRotation: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, 0)
      };
    });
  }, [count, scaleBase, chaosRadius, type]);

  const currentProgress = useRef(1);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const targetP = handData.state === HandState.OPEN ? 0 : 1;
    // Apply "Weight" to speed. Heavier items move slower.
    const speed = (handData.state === HandState.OPEN ? 3.0 : 1.5) / weight; 
    
    currentProgress.current = THREE.MathUtils.lerp(currentProgress.current, targetP, delta * speed);
    const t = currentProgress.current;
    
    // Cubic ease for movement
    const ease = 1.0 - pow(1.0 - t, 3.0);

    data.forEach((item, i) => {
      // Position Lerp
      dummy.position.lerpVectors(item.chaos, item.target, ease);
      
      // Rotation Lerp (spin wildly in chaos, stable in tree)
      if (t < 0.9) {
          dummy.rotation.x = item.chaosRotation.x + state.clock.elapsedTime * (1-t);
          dummy.rotation.y = item.chaosRotation.y + state.clock.elapsedTime * (1-t);
      } else {
          dummy.rotation.copy(item.rotation);
      }

      dummy.scale.setScalar(item.scale * (0.5 + 0.5 * t)); // Shrink slightly in chaos
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} castShadow receiveShadow />
  );
};

// --- Main Tree Component ---

export const Tree: React.FC<{ handData: HandData }> = ({ handData }) => {
  // Geometries & Materials shared
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  
  const goldMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: COLOR_GOLD, metalness: 1, roughness: 0.1, envMapIntensity: 2 
  }), []);
  
  const rubyMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: COLOR_RUBY, metalness: 0.6, roughness: 0.2, envMapIntensity: 1.5 
  }), []);

  const lightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: COLOR_WARM_WHITE, emissive: COLOR_WARM_WHITE, emissiveIntensity: 5, toneMapped: false
  }), []);

  return (
    <group>
      {/* 1. The Needle System (Particles) */}
      <FoliageSystem handData={handData} />

      {/* 2. Heavy Ornaments (Gifts at base) */}
      <InstancedDecor 
        count={GIFT_COUNT} 
        geometry={boxGeo} 
        material={goldMat} 
        scaleBase={0.6} 
        chaosRadius={12} 
        weight={1.8} 
        handData={handData}
        type="gift"
      />

      {/* 3. Gold Baubles */}
      <InstancedDecor 
        count={ORNAMENT_COUNT / 2} 
        geometry={sphereGeo} 
        material={goldMat} 
        scaleBase={0.25} 
        chaosRadius={18} 
        weight={1.2} 
        handData={handData}
        type="ornament"
      />

      {/* 4. Ruby Baubles */}
      <InstancedDecor 
        count={ORNAMENT_COUNT / 2} 
        geometry={sphereGeo} 
        material={rubyMat} 
        scaleBase={0.25} 
        chaosRadius={18} 
        weight={1.2} 
        handData={handData}
        type="ornament"
      />

      {/* 5. Fairy Lights (Lightweight, floaty) */}
      <InstancedDecor 
        count={LIGHT_COUNT} 
        geometry={sphereGeo} 
        material={lightMat} 
        scaleBase={0.08} 
        chaosRadius={22} 
        weight={0.8} 
        handData={handData}
        type="light"
      />
    </group>
  );
};

function pow(a: number, b: number) {
    return Math.pow(a, b);
}
