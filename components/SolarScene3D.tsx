'use client';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Cloud, Clouds, Html, RoundedBox, Float, Sparkles, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useSolarSystem } from '../app/page';
import { Battery as BatteryIcon, Sun, Home } from 'lucide-react';

// Smooth Appliance Components
const SmoothFridge = ({ isOn, name }: { isOn: boolean, name: string }) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, delta) => {
    if (matRef.current) {
      const targetEmissive = isOn ? new THREE.Color("#06b6d4") : new THREE.Color("#000000");
      const targetColor = isOn ? new THREE.Color("#f8fafc") : new THREE.Color("#94a3b8");
      matRef.current.emissive.lerp(targetEmissive, delta * 5);
      matRef.current.color.lerp(targetColor, delta * 5);
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(matRef.current.emissiveIntensity, isOn ? 0.2 : 0, delta * 5);
    }
  });
  return (
    <group position={[-2.5, 1, -2]}>
      <Html position={[0, 1.5, 0]} center>
        <div className="text-[10px] font-bold text-white bg-black/50 px-1 rounded">{name}</div>
      </Html>
      <mesh castShadow>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial ref={matRef} metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

const SmoothTV = ({ isOn, name }: { isOn: boolean, name: string }) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, delta) => {
    if (matRef.current) {
      const targetEmissive = isOn ? new THREE.Color("#3b82f6") : new THREE.Color("#000000");
      matRef.current.emissive.lerp(targetEmissive, delta * 5);
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(matRef.current.emissiveIntensity, isOn ? 1.5 : 0, delta * 5);
    }
  });
  return (
    <group position={[2, 1, 2.8]}>
      <Html position={[0, 1, 0]} center>
        <div className="text-[10px] font-bold text-white bg-black/50 px-1 rounded">{name}</div>
      </Html>
      <mesh position={[0, 0, -0.1]} castShadow>
        <boxGeometry args={[2, 1.2, 0.1]} />
        <meshStandardMaterial ref={matRef} color="#111827" />
      </mesh>
      <mesh position={[0, -0.7, -0.1]} castShadow>
        <boxGeometry args={[0.5, 0.2, 0.3]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  );
}

const SmoothAC = ({ isOn, name }: { isOn: boolean, name: string }) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, delta) => {
    if (matRef.current) {
      const targetEmissive = isOn ? new THREE.Color("#06b6d4") : new THREE.Color("#000000");
      matRef.current.emissive.lerp(targetEmissive, delta * 5);
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(matRef.current.emissiveIntensity, isOn ? 0.5 : 0, delta * 5);
    }
  });
  return (
    <group position={[2, 3.5, -2.8]}>
      <Html position={[0, 0.5, 0]} center>
        <div className="text-[10px] font-bold text-white bg-black/50 px-1 rounded">{name}</div>
      </Html>
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.4, 0.5]} />
        <meshStandardMaterial ref={matRef} color="#e2e8f0" />
      </mesh>
      {isOn && <Sparkles position={[0, -0.5, 0]} scale={[1.5, 1, 1]} count={20} color="#67e8f9" speed={0.8} opacity={0.8} />}
    </group>
  );
}

const SmoothLight = ({ isOn, name }: { isOn: boolean, name: string }) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((_, delta) => {
    if (matRef.current) {
      const targetEmissive = isOn ? new THREE.Color("#facc15") : new THREE.Color("#000000");
      const targetColor = isOn ? new THREE.Color("#fde047") : new THREE.Color("#cbd5e1");
      matRef.current.emissive.lerp(targetEmissive, delta * 5);
      matRef.current.color.lerp(targetColor, delta * 5);
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(matRef.current.emissiveIntensity, isOn ? 3 : 0, delta * 5);
    }
    if (lightRef.current) {
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, isOn ? 2 : 0, delta * 5);
    }
  });
  return (
    <group position={[0, 3.8, 0]}>
      <Html position={[0, -0.5, 0]} center>
        <div className="text-[10px] font-bold text-white bg-black/50 px-1 rounded">{name}</div>
      </Html>
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial ref={matRef} />
      </mesh>
      <pointLight ref={lightRef} position={[0, -0.5, 0]} color="#fef08a" distance={10} intensity={0} />
    </group>
  );
}

const sharedGlassMat = new THREE.MeshPhysicalMaterial({
  color: "#0f172a",
  metalness: 0.9,
  roughness: 0.05,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1
});

const SmoothSolarArray = ({ isProducing }: { isProducing: boolean }) => {
  useFrame((_, delta) => {
    const targetEmissive = isProducing ? new THREE.Color("#0284c7") : new THREE.Color("#000000");
    sharedGlassMat.emissive.lerp(targetEmissive, delta * 3);
    sharedGlassMat.emissiveIntensity = THREE.MathUtils.lerp(sharedGlassMat.emissiveIntensity, isProducing ? 0.8 : 0, delta * 3);
  });

  return (
    <group position={[0, 4.4, 0]} rotation={[-Math.PI / 16, 0, 0]}>
      <Label color="bg-amber-900/80 border-amber-400/50" position={[0, 1.5, 0]}>
        <Sun className="w-4 h-4 text-amber-400" /> ROOF SOLAR ARRAY
      </Label>
      
      {[-2.1, 0, 2.1].map(x => (
        [-1.2, 1.2].map(z => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            {/* Frame */}
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[2.0, 0.1, 2.3]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.4} />
            </mesh>
            {/* Glass Surface */}
            <mesh castShadow receiveShadow position={[0, 0.06, 0]} material={sharedGlassMat}>
              <boxGeometry args={[1.9, 0.02, 2.2]} />
            </mesh>
          </group>
        ))
      ))}
      {isProducing && <Sparkles position={[0, 0.5, 0]} scale={[6.5, 1, 5]} size={5} count={40} color="#fbbf24" speed={0.4} opacity={0.6} />}
    </group>
  );
}

const Label = ({ children, color = "bg-slate-900/80", position = [0, 2.5, 0] }: { children: React.ReactNode, color?: string, position?: [number, number, number] }) => (
  <Html center position={position}>
    <div className={`px-4 py-2 rounded-xl border border-white/20 backdrop-blur-md text-white text-sm font-bold whitespace-nowrap flex items-center gap-2 shadow-2xl ${color}`}>
      {children}
    </div>
  </Html>
);

const BigHouse = ({ isProducing }: { isProducing: boolean }) => {
  const { appliances } = useSolarSystem();
  return (
    <group position={[0, 0, 0]}>
      <Float speed={2} rotationIntensity={0.05} floatIntensity={0.1}>
        <Label color="bg-indigo-900/80 border-indigo-400/50" position={[0, 7.5, 0]}>
          <Home className="w-4 h-4 text-indigo-400" /> SMART VILLA
        </Label>
        
        {/* Main Body (Glass) */}
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <RoundedBox args={[7, 4, 6]} radius={0.2} smoothness={4}>
            <meshPhysicalMaterial 
              color="#f8fafc" 
              metalness={0.1} 
              roughness={0.1} 
              transparent={true} 
              opacity={0.3} 
              transmission={0.9} 
              thickness={0.5} 
              side={THREE.DoubleSide} 
            />
          </RoundedBox>
        </mesh>
        
        {/* Modern Flat Roof */}
        <mesh position={[0, 4.1, 0]} castShadow receiveShadow>
          <RoundedBox args={[7.5, 0.4, 6.5]} radius={0.1} smoothness={2}>
            <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.6} />
          </RoundedBox>
        </mesh>

        {/* Realistic Solar Panels on Roof */}
        <SmoothSolarArray isProducing={isProducing} />

        {/* Big Door */}
        <mesh position={[0, 1.2, 3.01]} castShadow>
          <boxGeometry args={[1.5, 2.2, 0.1]} />
          <meshStandardMaterial color="#8b5cf6" metalness={0.4} roughness={0.4} />
        </mesh>

        {/* Glowing Windows */}
        <mesh position={[-2, 2, 3.01]}>
          <boxGeometry args={[1.5, 1.2, 0.05]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={1.5} transparent opacity={0.5} />
        </mesh>
        <mesh position={[2, 2, 3.01]}>
          <boxGeometry args={[1.5, 1.2, 0.05]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={1.5} transparent opacity={0.5} />
        </mesh>

        {/* Appliances Inside */}
        <group position={[0, 0, 0]}>
          {appliances.map(app => {
            if (app.id === 'fridge') return <SmoothFridge key={app.id} isOn={app.isOn} name={app.name} />;
            if (app.id === 'tv') return <SmoothTV key={app.id} isOn={app.isOn} name={app.name} />;
            if (app.id === 'ac') return <SmoothAC key={app.id} isOn={app.isOn} name={app.name} />;
            if (app.id === 'light') return <SmoothLight key={app.id} isOn={app.isOn} name={app.name} />;
            return null;
          })}
        </group>
      </Float>
    </group>
  );
};



const Battery = ({ level }: { level: number }) => {
  const fillMesh = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    if (fillMesh.current) {
      const targetHeight = Math.max(0.1, (3 * level) / 100);
      fillMesh.current.scale.y = THREE.MathUtils.lerp(fillMesh.current.scale.y, targetHeight, delta * 5);
      fillMesh.current.position.y = THREE.MathUtils.lerp(fillMesh.current.position.y, targetHeight / 2, delta * 5);
    }
    if (coreMat.current) {
      const targetColor = level < 20 ? new THREE.Color("#ef4444") : new THREE.Color("#10b981");
      coreMat.current.color.lerp(targetColor, delta * 5);
      coreMat.current.emissive.lerp(targetColor, delta * 5);
    }
  });

  return (
    <group position={[6, 0, 1]}>
      <Float speed={2} rotationIntensity={0.05} floatIntensity={0.1}>
        <Label color="bg-emerald-900/80 border-emerald-400/50"><BatteryIcon className="w-4 h-4 text-emerald-400" /> STORAGE {level.toFixed(0)}%</Label>
        
        {/* Inner Core */}
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.2, 1.2, 3, 32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Top/Bottom Caps */}
        <mesh position={[0, 3.1, 0]}>
          <cylinderGeometry args={[1.3, 1.3, 0.2, 32]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[1.3, 1.3, 0.2, 32]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>

        {/* Glowing Level Fill */}
        <group position={[0, 0, 0]}>
          <mesh ref={fillMesh} position={[0, 0, 0]}>
            <cylinderGeometry args={[1.25, 1.25, 1, 32]} />
            <meshStandardMaterial ref={coreMat} transparent opacity={0.8} emissiveIntensity={2} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* Glass Outer Shell */}
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[1.35, 1.35, 3, 32]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.15} metalness={0.9} roughness={0.1} side={THREE.DoubleSide} />
        </mesh>
      </Float>
    </group>
  );
};

const Rain = () => {
  const count = 1000;
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [particles] = useState(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 30;
      const y = Math.random() * 20;
      const z = (Math.random() - 0.5) * 30;
      const speed = 0.1 + Math.random() * 0.2;
      temp.push({ x, y, z, speed });
    }
    return temp;
  });

  useFrame(() => {
    if (mesh.current) {
      particles.forEach((particle, i) => {
        particle.y -= particle.speed;
        if (particle.y < 0) {
          particle.y = 20;
        }
        dummy.position.set(particle.x, particle.y, particle.z);
        dummy.scale.set(0.05, 0.5, 0.05);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
      });
      mesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <instancedMesh ref={mesh} args={[undefined as any, undefined as any, count]}>
      <cylinderGeometry args={[1, 1, 1, 4]} />
      <meshBasicMaterial color="#93c5fd" transparent opacity={0.4} />
    </instancedMesh>
  );
};

const SkyBodies = ({ isNight, isStorm }: { isNight: boolean, isStorm: boolean }) => {
  const sunPos = new THREE.Vector3(20, 12, -40);
  const moonPos = new THREE.Vector3(-20, 12, -40);
  
  return (
    <>
      {/* Sun */}
      {!isNight && (
        <mesh position={sunPos}>
          <sphereGeometry args={[8, 32, 32]} />
          <meshBasicMaterial color={isStorm ? "#94a3b8" : "#fef08a"} />
          {/* Subtle glow ring */}
          {!isStorm && (
            <mesh position={[0, 0, -1]}>
              <circleGeometry args={[12, 32]} />
              <meshBasicMaterial color="#fef08a" transparent opacity={0.2} />
            </mesh>
          )}
        </mesh>
      )}
      
      {/* Moon */}
      {isNight && (
        <mesh position={moonPos}>
          <sphereGeometry args={[6, 32, 32]} />
          <meshStandardMaterial color="#f8fafc" emissive="#e2e8f0" emissiveIntensity={0.2} roughness={1} />
        </mesh>
      )}
    </>
  );
};

export const SolarScene3D = () => {
  const { latestStat, weatherMode } = useSolarSystem();
  
  const isNight = latestStat.hour < 6 || latestStat.hour >= 18;
  const isProducing = latestStat.solarPower > 0;
  const isStorm = weatherMode === 'STORM';

  let bgColor = '#0284c7';
  let ambientInt = 0.8;
  let dirInt = 2.0;

  if (isNight) {
    bgColor = '#020617';
    ambientInt = 0.3;
    dirInt = 0.5;
  } else {
    if (weatherMode === 'CLOUDY') {
      bgColor = '#64748b';
      ambientInt = 0.6;
      dirInt = 0.8;
    } else if (weatherMode === 'STORM') {
      bgColor = '#0f172a';
      ambientInt = 0.2;
      dirInt = 0.1;
    } else if (weatherMode === 'OVERLOAD') {
      bgColor = '#0369a1';
      ambientInt = 1.0;
      dirInt = 3.0;
    }
  }

  let groundColor = '#15803d';
  if (isNight) groundColor = '#0f172a';
  else if (weatherMode === 'STORM') groundColor = '#1e293b';
  else if (weatherMode === 'CLOUDY') groundColor = '#3f6212';

  return (
    <div className="absolute inset-0 z-0">
      <Canvas shadows camera={{ position: [0, 8, 14], fov: 45 }}>
        <color attach="background" args={[bgColor]} />
        <ambientLight intensity={ambientInt} />
        <directionalLight 
          position={isNight ? [-5, 5, -5] : [5, 12, 5]} 
          intensity={dirInt} 
          castShadow 
          color={isNight ? "#818cf8" : (weatherMode === 'OVERLOAD' ? "#ffedd5" : "#ffffff")}
        />
        <Environment preset="city" />
        <SkyBodies isNight={isNight} isStorm={isStorm} />
        
        {isNight && !isStorm && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
        {weatherMode === 'CLOUDY' && (
          <group position={[0, 25, -20]}>
            <Clouds material={THREE.MeshBasicMaterial}>
              <Cloud segments={60} bounds={[20, 5, 10]} volume={20} color="#cbd5e1" position={[-15, 0, 0]} opacity={0.5} speed={0.1} />
              <Cloud segments={60} bounds={[20, 5, 10]} volume={20} color="#94a3b8" position={[15, 0, 0]} opacity={0.4} speed={0.1} />
            </Clouds>
          </group>
        )}
        {isStorm && <Rain />}

        {/* Enhanced Cyber Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[150, 150]} />
          <meshStandardMaterial color={groundColor} metalness={0.2} roughness={0.8} />
        </mesh>
        
        {/* Isometric Grid Helper for Tech Look */}
        <gridHelper args={[150, 150, isNight ? '#1e293b' : '#3f6212', isNight ? '#1e293b' : '#3f6212']} position={[0, 0, 0]} />

        {/* Smooth Ambient Shadows */}
        <ContactShadows position={[0, -0.04, 0]} opacity={0.6} scale={30} blur={2} far={10} />

        <BigHouse isProducing={isProducing} />
        <Battery level={latestStat.batteryState} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.2} />
        </EffectComposer>

        <OrbitControls 
          enablePan={false} 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={8}
          maxDistance={30}
          autoRotate={!isStorm}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};
