'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSolarSystem } from '../app/page';

/*
 * HUAWEI FUSIONSOLAR AESTHETIC REWRITE
 * - Ultra-clean, light gray vector-style look
 * - A-Frame house with garage on left
 * - Utility pole on far left
 * - Fixed isometric camera
 * - Exact text labels with dashed connector lines
 */

// --- Materials (Cached) ---
const m = {
  white: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  baseGray: new THREE.MeshLambertMaterial({ color: '#e5e7eb' }),
  darkGray: new THREE.MeshLambertMaterial({ color: '#9ca3af' }),
  bluePanel: new THREE.MeshLambertMaterial({ color: '#1e3a8a' }),
  panelFrame: new THREE.MeshLambertMaterial({ color: '#d1d5db' }),
  glass: new THREE.MeshLambertMaterial({ color: '#f3f4f6', transparent: true, opacity: 0.8 }),
  glassFrame: new THREE.MeshLambertMaterial({ color: '#6b7280' }),
  batteryGreen: new THREE.MeshBasicMaterial({ color: '#22c55e' }),
  lineGray: new THREE.MeshBasicMaterial({ color: '#9ca3af' }),
  poleGray: new THREE.MeshLambertMaterial({ color: '#d1d5db' }),
  wire: new THREE.MeshBasicMaterial({ color: '#6b7280' }),
  floor: new THREE.MeshLambertMaterial({ color: '#f8fafc' }),
  platform: new THREE.MeshLambertMaterial({ color: '#94a3b8' })
};

// --- Geometries (Cached) ---
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const prism = new THREE.CylinderGeometry(1, 1, 1, 3); // Triangular prism
const plane = new THREE.PlaneGeometry(100, 100);

// --- Formatter ---
const formatKW = (watts: number) => (watts / 1000).toFixed(3);

// --- Label Component (with SVG dashed line) ---
const DashedLabel = ({ position, text, subtext, value, unit, lineColor, lineLength, lineAngle, align = 'left' }: {
  position: [number, number, number], text: string, subtext?: string, value: number, unit: string,
  lineColor: string, lineLength: number, lineAngle: number, align?: 'left' | 'right' | 'center'
}) => {
  // lineAngle in degrees (0 = right, 90 = up, 180 = left, 270 = down)
  const rad = (lineAngle * Math.PI) / 180;
  const dx = Math.cos(rad) * lineLength;
  const dy = Math.sin(rad) * lineLength;

  return (
    <Html position={position} center zIndexRange={[100, 0]}>
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {/* SVG Dashed Line */}
        <svg style={{
          position: 'absolute',
          top: Math.min(0, -dy),
          left: Math.min(0, dx),
          width: Math.abs(dx) + 2,
          height: Math.abs(dy) + 2,
          pointerEvents: 'none',
          overflow: 'visible'
        }}>
          <line
            x1={dx < 0 ? Math.abs(dx) : 0} y1={dy > 0 ? dy : 0}
            x2={dx < 0 ? 0 : dx} y2={dy > 0 ? 0 : -dy}
            stroke={lineColor}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Text Box */}
        <div style={{
          position: 'absolute',
          top: -dy - 20,
          left: dx + (align === 'right' ? -120 : align === 'center' ? -60 : 10),
          width: 150,
          textAlign: align,
          pointerEvents: 'none',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'baseline', justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', gap: '4px' }}>
            {formatKW(value)} <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{unit}</span>
            {subtext && <span style={{ fontSize: '13px', fontWeight: 700, color: '#d97706', marginLeft: '4px' }}>{subtext}</span>}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '2px' }}>
            {text}
          </div>
        </div>
      </div>
    </Html>
  );
};

// --- Models ---
const UtilityPole = () => (
  <group position={[-5, 2.5, -2.5]}>
    {/* Main Pole */}
    <mesh geometry={box} scale={[0.15, 6, 0.15]} material={m.poleGray} />
    {/* Cross arms */}
    <mesh position={[0, 2.2, 0]} geometry={box} scale={[2.5, 0.1, 0.1]} material={m.poleGray} />
    <mesh position={[0, 1.4, 0]} geometry={box} scale={[1.8, 0.1, 0.1]} material={m.poleGray} />
    {/* Insulators */}
    {[-1.1, 0, 1.1].map(x => (
      <mesh key={`ins1-${x}`} position={[x, 2.3, 0]} geometry={cyl} scale={[0.08, 0.2, 0.08]} material={m.darkGray} />
    ))}
    {[-0.7, 0.7].map(x => (
      <mesh key={`ins2-${x}`} position={[x, 1.5, 0]} geometry={cyl} scale={[0.08, 0.2, 0.08]} material={m.darkGray} />
    ))}
    {/* Transformer / Box */}
    <mesh position={[0.25, -0.5, 0.15]} geometry={box} scale={[0.5, 0.7, 0.4]} material={m.baseGray} />
    {/* Wire to house */}
    <mesh position={[1.8, 0.5, 1.2]} rotation={[0, -0.2, -Math.PI / 5]} geometry={cyl} scale={[0.02, 5, 0.02]} material={m.wire} />
  </group>
);

// --- Dynamic Materials ---
const mGlassOff = new THREE.MeshLambertMaterial({ color: '#f3f4f6', transparent: true, opacity: 0.8 });
const mGlassOn = new THREE.MeshLambertMaterial({ color: '#fde047', transparent: true, opacity: 0.9, emissive: '#fde047', emissiveIntensity: 0.5 });
const mTVOn = new THREE.MeshBasicMaterial({ color: '#3b82f6' });

// --- Environment Components ---
const SkyEnv = ({ hour, weather }: { hour: number, weather: string }) => {
  const isNight = hour < 6 || hour > 18;
  const isStorm = weather === 'STORM';
  const isCloudy = weather === 'CLOUDY';

  // Calculate sky color
  let skyColor = '#f8fafc'; // Day
  if (isNight) skyColor = '#0f172a'; // Night
  else if (isStorm) skyColor = '#475569'; // Storm
  else if (isCloudy) skyColor = '#cbd5e1'; // Cloudy

  // Sun position (arch from 6 to 18)
  let sunY = -10;
  let sunX = 0;
  if (!isNight) {
    const progress = (hour - 6) / 12; // 0 to 1
    const angle = Math.PI - (progress * Math.PI); // PI to 0
    sunX = Math.cos(angle) * 20;
    sunY = Math.sin(angle) * 15;
  }

  return (
    <>
      <color attach="background" args={[skyColor]} />
      {/* Sun Mesh */}
      {!isNight && !isStorm && (
        <mesh position={[sunX, sunY, -15]}>
          <circleGeometry args={[2, 32]} />
          <meshBasicMaterial color={weather === 'OVERLOAD' ? '#f97316' : '#fbbf24'} />
        </mesh>
      )}
      
      {/* Lighting */}
      <ambientLight intensity={isNight ? 0.2 : (isStorm ? 0.6 : 1.5)} color="#ffffff" />
      <directionalLight position={[15, 20, 10]} intensity={isNight ? 0.1 : 0.4} color="#ffffff" />
      
      {/* Rain Effect */}
      {isStorm && <RainEffect />}
    </>
  );
};

const RainEffect = () => {
  const rainRef = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (rainRef.current) {
      rainRef.current.position.y -= d * 15;
      if (rainRef.current.position.y < -10) rainRef.current.position.y = 10;
    }
  });

  return (
    <group ref={rainRef} position={[0, 10, 0]}>
      {Array.from({ length: 50 }).map((_, i) => (
        <mesh 
          key={i} 
          position={[(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20]}
          geometry={box}
          scale={[0.02, 0.4, 0.02]}
          material={new THREE.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.5 })}
        />
      ))}
    </group>
  );
};

const HouseBase = ({ isLightOn, isTvOn, isAcOn }: { isLightOn: boolean, isTvOn: boolean, isAcOn: boolean }) => {
  const acFanRef = useRef<THREE.Mesh>(null);
  const tvRef = useRef<THREE.Mesh>(null);

  useFrame((_, d) => {
    if (isAcOn && acFanRef.current) acFanRef.current.rotation.z += d * 10;
    if (isTvOn && tvRef.current) {
      (tvRef.current.material as THREE.Material).opacity = 0.5 + Math.random() * 0.5; // Flicker
    }
  });

  return (
    <group>
      {/* Foundation Platform */}
      <mesh position={[-1, -0.1, 0]} geometry={box} scale={[12, 0.2, 7]} material={m.platform} />
      
      {/* Garage (Left side) */}
      <group position={[-3.5, 1.3, 0]}>
        <mesh geometry={box} scale={[3.5, 2.6, 4.5]} material={m.baseGray} />
        <mesh position={[0, 1.35, 0]} geometry={box} scale={[3.7, 0.1, 4.7]} material={m.white} />
        <mesh position={[0, -0.3, 2.26]} geometry={box} scale={[2.4, 2.0, 0.02]} material={m.darkGray} />
        <mesh position={[1.8, -0.4, 1.8]} geometry={cyl} scale={[0.05, 1.6, 0.05]} material={new THREE.MeshLambertMaterial({ color: '#eab308' })} />
        <mesh position={[2.0, -1.18, 1.8]} rotation={[0, 0, Math.PI / 2]} geometry={cyl} scale={[0.05, 0.4, 0.05]} material={new THREE.MeshLambertMaterial({ color: '#eab308' })} />
      </group>

      {/* Main House (Right side) */}
      <group position={[1.5, 1.3, 0]}>
        <mesh geometry={box} scale={[4.5, 2.6, 4.5]} material={m.white} />
        
        {/* Dynamic Glass Windows */}
        <mesh position={[0, -0.1, 2.26]} geometry={box} scale={[3.8, 1.8, 0.02]} material={isLightOn ? mGlassOn : mGlassOff} />
        
        {/* TV Screen inside */}
        {isTvOn && (
          <mesh ref={tvRef} position={[0, -0.2, 2.2]} geometry={box} scale={[1.8, 1.0, 0.01]} material={mTVOn} />
        )}

        <mesh position={[0, -0.1, 2.27]} geometry={box} scale={[4, 0.1, 0.05]} material={m.glassFrame} />
        <mesh position={[0, 0.8, 2.27]} geometry={box} scale={[4, 0.1, 0.05]} material={m.glassFrame} />
        <mesh position={[0, -1.0, 2.27]} geometry={box} scale={[4, 0.1, 0.05]} material={m.glassFrame} />
        <mesh position={[-1.95, -0.1, 2.27]} geometry={box} scale={[0.1, 1.8, 0.05]} material={m.glassFrame} />
        <mesh position={[1.95, -0.1, 2.27]} geometry={box} scale={[0.1, 1.8, 0.05]} material={m.glassFrame} />

        {/* AC Compressor */}
        <group position={[2.35, -0.6, 1.0]}>
          <mesh geometry={box} scale={[0.2, 0.8, 1.2]} material={m.white} />
          <mesh position={[0.11, 0, 0]} geometry={cyl} scale={[0.02, 0.6, 0.6]} rotation={[0, 0, Math.PI/2]} material={m.darkGray} />
          <mesh ref={acFanRef} position={[0.12, 0, 0]} geometry={box} scale={[0.01, 0.5, 0.1]} rotation={[0, 0, 0]} material={m.baseGray} />
        </group>

        {/* Roof */}
        <group position={[0, 1.3, 0]}>
          <mesh position={[-1.2, 0.6, 0]} rotation={[0, 0, Math.PI / 6]} geometry={box} scale={[3.0, 0.15, 4.8]} material={m.baseGray} />
          <mesh position={[1.2, 0.6, 0]} rotation={[0, 0, -Math.PI / 6]} geometry={box} scale={[3.0, 0.15, 4.8]} material={m.baseGray} />
          <mesh position={[-0.9, 0.3, 2.2]} rotation={[0, 0, Math.PI / 6]} geometry={box} scale={[2.5, 1.5, 0.1]} material={isLightOn ? mGlassOn : m.white} />
          <mesh position={[0.9, 0.3, 2.2]} rotation={[0, 0, -Math.PI / 6]} geometry={box} scale={[2.5, 1.5, 0.1]} material={isLightOn ? mGlassOn : m.white} />
          <mesh position={[-0.9, 0.3, -2.2]} rotation={[0, 0, Math.PI / 6]} geometry={box} scale={[2.5, 1.5, 0.1]} material={m.white} />
          <mesh position={[0.9, 0.3, -2.2]} rotation={[0, 0, -Math.PI / 6]} geometry={box} scale={[2.5, 1.5, 0.1]} material={m.white} />
        </group>
      </group>
    </group>
  );
};

const SolarPanels = () => {
  return (
    // Positioned EXACTLY on top of the left roof panel of the Main House.
    // Main house X=1.5, Y=1.3. Roof group Y=1.3. Left panel X=-1.2, Y=0.6.
    // Absolute position = [1.5 - 1.2, 1.3 + 1.3 + 0.6, 0] = [0.3, 3.2, 0]
    <group position={[0.3, 3.2, 0]} rotation={[0, 0, Math.PI / 6]}>
      {/* 2x3 Grid of Panels */}
      {[-0.6, 0.6].map(x =>
        [-1, 0, 1].map(z => (
          <group key={`${x}-${z}`} position={[x, 0.12, z]}>
            {/* Panel Base/Frame */}
            <mesh geometry={box} scale={[1.1, 0.05, 0.9]} material={m.panelFrame} />
            {/* Blue Cell Area */}
            <mesh position={[0, 0.03, 0]} geometry={box} scale={[1.05, 0.02, 0.85]} material={m.bluePanel} />
            {/* Thin Grid Lines */}
            <mesh position={[0, 0.04, 0]} geometry={box} scale={[0.02, 0.01, 0.85]} material={m.panelFrame} />
            <mesh position={[0, 0.04, 0]} geometry={box} scale={[1.05, 0.01, 0.02]} material={m.panelFrame} />
          </group>
        ))
      )}
    </group>
  );
};

const BatteryWall = ({ level }: { level: number }) => {
  const fillRef = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (fillRef.current) {
      const h = Math.max(0.01, (1.1 * level) / 100);
      fillRef.current.scale.y = THREE.MathUtils.lerp(fillRef.current.scale.y, h, d * 4);
      fillRef.current.position.y = THREE.MathUtils.lerp(fillRef.current.position.y, -0.55 + h / 2, d * 4);
    }
  });

  return (
    // Mounted on the front wall of the house (where garage meets the house)
    <group position={[-1.2, 1.0, 2.3]}>
      {/* Battery Box */}
      <mesh geometry={box} scale={[0.7, 1.4, 0.1]} material={m.white} />
      <mesh position={[0, 0, 0.06]} geometry={box} scale={[0.6, 1.3, 0.01]} material={m.baseGray} />
      
      {/* LED indicators */}
      <group position={[0, 0, 0.07]}>
        {[-0.4, -0.2, 0, 0.2, 0.4].map((y, i) => (
          // Change color based on charge level (rough estimate for visual)
          <mesh key={y} position={[0, y, 0]} geometry={box} scale={[0.4, 0.08, 0.01]} material={(level > (i * 20)) ? m.batteryGreen : m.darkGray} />
        ))}
      </group>
      
      {/* Inverter Box directly above */}
      <mesh position={[0, 0.9, 0]} geometry={box} scale={[0.5, 0.4, 0.1]} material={m.white} />
      <mesh position={[0, 0.9, 0.06]} geometry={box} scale={[0.4, 0.3, 0.01]} material={m.darkGray} />
      
      {/* Connecting Wire */}
      <mesh position={[-0.2, 0.7, 0.03]} geometry={box} scale={[0.02, 0.1, 0.02]} material={m.darkGray} />
    </group>
  );
};

// --- Trees (Soft spherical blobs in background) ---
const Trees = () => (
  <group position={[0, -0.1, -4]}>
    <mesh position={[-6, 1.5, -2]} geometry={cyl} scale={[2.5, 3, 2.5]} material={m.baseGray} />
    <mesh position={[-8, 1, 1]} geometry={cyl} scale={[2, 2, 2]} material={m.baseGray} />
    <mesh position={[6, 1.5, -2]} geometry={cyl} scale={[2.5, 3, 2.5]} material={m.baseGray} />
    <mesh position={[8, 1, 1]} geometry={cyl} scale={[2, 2, 2]} material={m.baseGray} />
  </group>
);


// --- Main ---
export const SolarScene3D = () => {
  const { weatherMode, appliances, latestStat, isAiAutoMode, aiLogs } = useSolarSystem();
  
  // Safe fallbacks
  const consumption = latestStat.homeConsumption ?? 0;
  const solarPower = latestStat.solarPower ?? 0;
  const batteryState = latestStat.batteryState ?? 0;
  const gridImport = latestStat.gridImport ?? 0;

  // Extract time from label (e.g. "14:30") to hour float
  const timeParts = (latestStat.timeLabel || "12:00").split(':');
  const hourFloat = parseInt(timeParts[0] || '12') + parseInt(timeParts[1] || '0') / 60;

  const isLightOn = appliances.find(a => a.id === 'light')?.isOn ?? false;
  const isTvOn = appliances.find(a => a.id === 'tv')?.isOn ?? false;
  const isAcOn = appliances.find(a => a.id === 'ac')?.isOn ?? false;

  const latestAiLog = aiLogs[0];

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 8, 25], fov: 30 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <SkyEnv hour={hourFloat} weather={weatherMode} />

        <mesh name="floor" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.11, 0]} geometry={plane} material={m.floor} />

        {/* --- Models --- */}
        <group position={[0, 0, -1]}>
          <Trees />
          <UtilityPole />
          <HouseBase isLightOn={isLightOn} isTvOn={isTvOn} isAcOn={isAcOn} />
          <SolarPanels />
          <BatteryWall level={batteryState} />

          {/* AI Auto-Pilot Billboard */}
          {isAiAutoMode && latestAiLog && (
            <Html position={[0, 7, 0]} center zIndexRange={[100, 0]}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid #10b981',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)',
                color: '#064e3b',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap'
              }}>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                🤖 AI: {latestAiLog.message}
              </div>
            </Html>
          )}

          {/* --- SVG Dashed Labels --- */}
          {/* GRID */}
          <DashedLabel 
            position={[-5, 1.5, 0]} 
            text="ไฟหลวง (Grid)" 
            value={gridImport} unit="kW" 
            lineColor={gridImport > 0 ? '#ef4444' : '#9ca3af'} // Red if importing
            lineLength={60} lineAngle={90} align="center"
          />
          {/* SOLAR */}
          <DashedLabel 
            position={[0, 4.2, 1.2]} 
            text="พลังงานแสงอาทิตย์ >" 
            value={solarPower} unit="kW" 
            lineColor={solarPower > 0 ? '#eab308' : '#9ca3af'} // Yellow if producing
            lineLength={80} lineAngle={75} align="left"
          />
          {/* LOAD */}
          <DashedLabel 
            position={[1, -0.1, 3]} 
            text="โหลด" 
            value={consumption} unit="kW" 
            lineColor={consumption > 0 ? '#3b82f6' : '#9ca3af'} // Blue if consuming
            lineLength={50} lineAngle={270} align="center"
          />
          {/* BATTERY */}
          <DashedLabel 
            position={[-1.2, 0.5, 3]} 
            text="แบตเตอรี่" 
            value={0} unit="kW" // We just show the level for now
            subtext={`${Math.floor(batteryState)}%`}
            lineColor={batteryState > 20 ? '#22c55e' : '#ef4444'} // Green or Red
            lineLength={70} lineAngle={270} align="left"
          />
        </group>

        <OrbitControls
          enablePan={false}
          enableRotate={false}
          enableZoom={false}
          target={[0, 1.5, 0]}
        />
      </Canvas>
    </div>
  );
};
