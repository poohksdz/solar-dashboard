'use client';

import React, { useState, useRef, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { Sun, Tv, Refrigerator, Lightbulb, Fan, Activity, Zap, Power, CloudLightning, CloudRain, SunMedium, BrainCircuit, Save, BarChart3 } from 'lucide-react';
import { motion, useAnimationFrame } from 'framer-motion';
import { SolarScene3D } from '../components/SolarScene3D';
import Link from 'next/link';

// --- TYPES ---
export interface SolarData {
  timeLabel: string;
  hour: number;
  solarPower: number;
  homeConsumption: number;
  batteryState: number;
  gridImport: number;
}

export interface AILog {
  id: string;
  timeLabel: string;
  message: string;
  type: 'info' | 'warn' | 'success';
}

export interface Appliance {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  power: number;
  isOn: boolean;
}

export type WeatherMode = 'NORMAL' | 'OVERLOAD' | 'CLOUDY' | 'STORM';

export interface House {
  id: string;
  name: string;
}

export interface SystemState {
  simTime: number;
  batteryLevel: number;
  totalSaved: number;
  appliances: Appliance[];
  dataHistory: SolarData[];
  weatherMode: WeatherMode;
  isEngineActive: boolean;
  isAiAutoMode: boolean;
  aiLogs: AILog[];
  houses: House[];
  selectedHouseId: string;
}

const CONFIG = {
  SIM_SPEED: 150, 
  BATTERY_CAPACITY: 10000, 
  SOLAR_MAX: 5000, 
  ELECTRICITY_RATE: 4.5, 
  AI_COOLDOWN_HOURS: 1,
  INITIAL_APPLIANCES: [
    { id: 'fridge', name: 'Smart Fridge', icon: Refrigerator, power: 150, isOn: true },
    { id: 'ac', name: 'Inverter AC', icon: Fan, power: 1200, isOn: false },
    { id: 'tv', name: 'OLED TV', icon: Tv, power: 250, isOn: false },
    { id: 'light', name: 'Hue Lights', icon: Lightbulb, power: 100, isOn: false },
  ]
};

const makeTimeLabel = (hour: number): string =>
  Math.floor(hour).toString().padStart(2, '0') + ':' +
  Math.floor((hour % 1) * 60).toString().padStart(2, '0');

interface SolarContextType extends SystemState {
  toggleAppliance: (id: string) => void;
  setWeatherMode: (mode: WeatherMode) => void;
  toggleEngine: () => void;
  setTime: (hour: number) => void;
  toggleAiAutoMode: () => void;
  saveSession: () => Promise<void>;
  setSelectedHouseId: (id: string) => void;
  latestStat: SolarData;
  isSaving: boolean;
}

const SolarContext = createContext<SolarContextType | null>(null);

export const useSolarSystem = () => {
  const context = useContext(SolarContext);
  if (!context) throw new Error("useSolarSystem must be used within SolarProvider");
  return context;
};

const useSolarEngine = () => {
  const [state, setState] = useState<SystemState>({
    simTime: 6,
    batteryLevel: 30,
    totalSaved: 0,
    appliances: CONFIG.INITIAL_APPLIANCES,
    dataHistory: [],
    weatherMode: 'NORMAL',
    isEngineActive: true,
    isAiAutoMode: false,
    aiLogs: [],
    houses: [{ id: 'default-house-1', name: 'Alpha Home' }],
    selectedHouseId: 'default-house-1'
  });

  const stateRef = useRef(state);
  const lastUpdateRef = useRef(0);
  const historyTimerRef = useRef(0);
  const aiLastSimHourRef = useRef(-1);
  const aiLogIdRef = useRef(0);
  const autoLogLastHourRef = useRef(-1);
  const notifiedLowBattery = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/houses').then(res => res.json()).then(data => {
      if (data.houses && data.houses.length > 0) {
        setState(prev => ({ ...prev, houses: data.houses, selectedHouseId: data.houses[0].id }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const toggleAppliance = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      appliances: prev.appliances.map(app => app.id === id ? { ...app, isOn: !app.isOn } : app)
    }));
  }, []);

  const setWeatherMode = useCallback((mode: WeatherMode) => {
    setState(prev => ({ ...prev, weatherMode: mode }));
  }, []);

  const toggleEngine = useCallback(() => {
    setState(prev => ({ ...prev, isEngineActive: !prev.isEngineActive }));
  }, []);

  const setSelectedHouseId = useCallback((id: string) => {
    setState(prev => ({ ...prev, selectedHouseId: id }));
  }, []);

  const setTime = useCallback((hour: number) => {
    setState(prev => ({ ...prev, simTime: hour }));
  }, []);

  const nextAiLogId = () => {
    aiLogIdRef.current += 1;
    return `ai-${aiLogIdRef.current}`;
  };

  const toggleAiAutoMode = useCallback(() => {
    setState(prev => {
      const engaging = !prev.isAiAutoMode;
      if (engaging) aiLastSimHourRef.current = prev.simTime;
      return {
        ...prev,
        isAiAutoMode: engaging,
        aiLogs: engaging ? [{
          id: nextAiLogId(),
          timeLabel: makeTimeLabel(prev.simTime),
          message: 'AI Auto-Pilot Engaged. Monitoring home systems.',
          type: 'success' as const
        }, ...prev.aiLogs].slice(0, 50) : [{
          id: nextAiLogId(),
          timeLabel: makeTimeLabel(prev.simTime),
          message: 'AI Auto-Pilot Disengaged.',
          type: 'info' as const
        }, ...prev.aiLogs].slice(0, 50)
      };
    });
  }, []);

  const saveSession = useCallback(async () => {
    setIsSaving(true);
    try {
      const current = stateRef.current;
      const lastH = current.dataHistory[current.dataHistory.length - 1];
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simTime: current.simTime,
          simTimeLabel: makeTimeLabel(current.simTime),
          batteryLevel: current.batteryLevel,
          totalSaved: current.totalSaved,
          weatherMode: current.weatherMode,
          solarPower: lastH?.solarPower ?? 0,
          homeConsumption: lastH?.homeConsumption ?? 0,
          gridImport: lastH?.gridImport ?? 0,
          appliances: current.appliances.map(a => ({ id: a.id, name: a.name, isOn: a.isOn, power: a.power })),
          aiAutoMode: current.isAiAutoMode,
          aiActionsCount: current.aiLogs.length,
          houseId: current.selectedHouseId,
        }),
      });
    } catch { /* silently fail */ }
    setIsSaving(false);
  }, []);

  useAnimationFrame((time) => {
    if (!lastUpdateRef.current) lastUpdateRef.current = time;
    const deltaTime = time - lastUpdateRef.current;
    lastUpdateRef.current = time;

    const current = stateRef.current;
    
    // Only advance time if engine is active
    const deltaHour = current.isEngineActive ? (deltaTime / 1000) * (CONFIG.SIM_SPEED / 3600) : 0;
    const nextHour = current.isEngineActive ? (current.simTime + deltaHour) % 24 : current.simTime;

    let currentHomeLoad = 100; // Base load
    let currentFridgePower = 150;
    
    current.appliances.forEach(app => {
      if (app.isOn) {
        if (app.id === 'fridge') {
          currentFridgePower = 150 + Math.sin(time / 1000) * 80; // Compressor cycling
          currentHomeLoad += currentFridgePower;
        } else {
          currentHomeLoad += app.power;
        }
      }
    });

    let solarProd = 0;
    if (nextHour > 6 && nextHour < 18) {
      const progress = (nextHour - 6) / 12;
      const curve = Math.sin(progress * Math.PI);
      
      let modifier = 1;
      let noise = Math.sin(time / 2000) * 0.05;
      
      if (current.weatherMode === 'OVERLOAD') {
        modifier = 1.2; 
        noise = 0;
      } else if (current.weatherMode === 'CLOUDY') {
        modifier = 0.3 + (Math.sin(time / 500) * 0.2); // highly fluctuating
      } else if (current.weatherMode === 'STORM') {
        modifier = 0; // No solar
      }

      solarProd = Math.max(0, CONFIG.SOLAR_MAX * (curve * modifier + noise));
    }

    const netPower = solarProd - currentHomeLoad;
    const energyDeltaWh = netPower * deltaHour; 
    let gridImport = 0;
    let newBattery = current.batteryLevel;

    newBattery += (energyDeltaWh / CONFIG.BATTERY_CAPACITY) * 100;
    
    if (newBattery < 0) {
      gridImport = Math.abs(netPower);
      newBattery = 0;
    }
    newBattery = Math.min(100, Math.max(0, newBattery));

    if (newBattery < 20 && !notifiedLowBattery.current) {
      notifiedLowBattery.current = true;
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🚨 CRITICAL BATTERY ALERT',
          message: `Battery level has dropped below 20% (${Math.floor(newBattery)}%). Immediate action required or grid import will increase.`,
          color: 16711680 // Red
        })
      }).catch(() => {});
    } else if (newBattery >= 30) {
      notifiedLowBattery.current = false;
    }

    // --- SKIP HISTORY WHEN ENGINE IS PAUSED ---
    if (!current.isEngineActive) {
      return;
    }

    if (time - historyTimerRef.current > 500) {
      historyTimerRef.current = time;
      
      const usedSolarWh = solarProd > 0 ? (solarProd * deltaHour) : 0;
      const newSaved = current.totalSaved + ((usedSolarWh / 1000) * CONFIG.ELECTRICITY_RATE);

      const timeLabel = makeTimeLabel(nextHour);

      const stat: SolarData = {
        hour: nextHour,
        timeLabel,
        solarPower: solarProd,
        homeConsumption: currentHomeLoad,
        batteryState: newBattery,
        gridImport: gridImport
      };

      // --- AI AUTO-PILOT LOGIC (sim-hour cooldown) ---
      let newAiLogs = [...current.aiLogs];
      let newAppliances = current.appliances.map(a => ({ ...a }));
      const isDayTime = nextHour > 6 && nextHour < 18;
      
      const hoursSinceLastAi = ((nextHour - aiLastSimHourRef.current) + 24) % 24;
      const aiShouldAct = current.isAiAutoMode && hoursSinceLastAi >= CONFIG.AI_COOLDOWN_HOURS;
      
      if (aiShouldAct) {
        aiLastSimHourRef.current = nextHour;
        const isBadWeather = current.weatherMode === 'STORM' || current.weatherMode === 'CLOUDY';
        const isGoodWeather = current.weatherMode === 'NORMAL' || current.weatherMode === 'OVERLOAD';
        let actionsThisPass = 0;
        
        // RULE 1: Critical battery — shed non-essential loads
        if (newBattery < 30 && (isBadWeather || !isDayTime) && netPower < 0) {
          const ac = newAppliances.find(a => a.id === 'ac');
          if (ac && ac.isOn) {
            newAppliances = newAppliances.map(a => a.id === 'ac' ? { ...a, isOn: false } : a);
            newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `⚠️ Battery critical (${Math.floor(newBattery)}%). Shutting down AC.`, type: 'warn' as const });
            actionsThisPass++;
          }
          const tv = newAppliances.find(a => a.id === 'tv');
          if (tv && tv.isOn && newBattery < 20) {
            newAppliances = newAppliances.map(a => a.id === 'tv' ? { ...a, isOn: false } : a);
            newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `⚠️ Battery very low (${Math.floor(newBattery)}%). Shutting down TV.`, type: 'warn' as const });
            actionsThisPass++;
          }
        }
        // RULE 2: Excess solar — utilize surplus energy
        else if (newBattery > 80 && isGoodWeather && isDayTime && netPower > 500) {
          const ac = newAppliances.find(a => a.id === 'ac');
          if (ac && !ac.isOn) {
            newAppliances = newAppliances.map(a => a.id === 'ac' ? { ...a, isOn: true } : a);
            newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `☀️ Excess solar (${Math.floor(netPower)}W surplus). Pre-cooling house.`, type: 'info' as const });
            actionsThisPass++;
          }
        }
        
        // RULE 3: Lights off during daytime (save energy)
        if (isDayTime && isGoodWeather) {
          const light = newAppliances.find(a => a.id === 'light');
          if (light && light.isOn) {
            newAppliances = newAppliances.map(a => a.id === 'light' ? { ...a, isOn: false } : a);
            newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `💡 Daylight detected. Turning off indoor lights.`, type: 'info' as const });
            actionsThisPass++;
          }
        }
        
        // Heartbeat: log status if no actions taken
        if (actionsThisPass === 0) {
          newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `✅ All systems nominal. Battery: ${Math.floor(newBattery)}%, Solar: ${Math.floor(solarProd)}W, Load: ${Math.floor(currentHomeLoad)}W.`, type: 'success' as const });
        }
        
        if (newAiLogs.length > 50) newAiLogs = newAiLogs.slice(0, 50);
      }
      // ---------------------------

      setState(prev => {
        const newHist = [...prev.dataHistory, stat];
        if (newHist.length > 50) newHist.shift(); 
        
        // Only write fridge power back if fridge is on
        const updatedAppliances = newAppliances.map(app => {
          if (app.id === 'fridge' && app.isOn) return { ...app, power: currentFridgePower };
          return app;
        });
        
        return {
          ...prev,
          simTime: nextHour,
          batteryLevel: newBattery,
          totalSaved: newSaved,
          dataHistory: newHist,
          appliances: updatedAppliances,
          aiLogs: newAiLogs
        };
      });
    } else {
      setState(prev => ({ ...prev, simTime: nextHour, batteryLevel: newBattery }));
    }

    // --- AUTO-LOG every 5 sim-hours ---
    if (current.isEngineActive) {
      const hoursSinceAutoLog = ((nextHour - autoLogLastHourRef.current) + 24) % 24;
      if (autoLogLastHourRef.current < 0 || hoursSinceAutoLog >= 5) {
        autoLogLastHourRef.current = nextHour;
        const lastH = current.dataHistory[current.dataHistory.length - 1];
        fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simTime: nextHour,
            simTimeLabel: makeTimeLabel(nextHour),
            batteryLevel: newBattery,
            totalSaved: current.totalSaved,
            weatherMode: current.weatherMode,
            solarPower: lastH?.solarPower ?? 0,
            homeConsumption: lastH?.homeConsumption ?? 0,
            gridImport: lastH?.gridImport ?? 0,
            appliances: current.appliances.map(a => ({ id: a.id, name: a.name, isOn: a.isOn, power: a.power })),
            aiAutoMode: current.isAiAutoMode,
            aiActionsCount: current.aiLogs.length,
            houseId: current.selectedHouseId,
          }),
        }).catch(() => {});
      }
    }
  });

  // Build latestStat from live state so HUD/3D always reflect current simTime & battery
  const lastHistory = state.dataHistory[state.dataHistory.length - 1];
  const latestStat: SolarData = {
    hour: state.simTime,
    timeLabel: makeTimeLabel(state.simTime),
    solarPower: lastHistory?.solarPower ?? 0,
    homeConsumption: lastHistory?.homeConsumption ?? 0,
    batteryState: state.batteryLevel,
    gridImport: lastHistory?.gridImport ?? 0,
  };

  return { ...state, toggleAppliance, setWeatherMode, toggleEngine, setTime, toggleAiAutoMode, saveSession, setSelectedHouseId, latestStat, isSaving };
};

// --- COMPONENTS ---

const AnalyticsChart = () => {
  const { dataHistory } = useSolarSystem();
  
  const chartData = useMemo(() => dataHistory, [dataHistory]);

  return (
    <div className="flex-1 bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl flex flex-col w-full h-[400px]">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex gap-2 items-center"><Activity className="w-5 h-5 text-indigo-400" /> Power Analytics</h2>
        <div className="flex gap-4 text-[10px] font-bold bg-black/40 px-4 py-2 rounded-xl border border-white/10">
          <span className="flex items-center gap-1 text-amber-300"><div className="w-2 h-2 bg-amber-400" /> SOLAR</span>
          <span className="flex items-center gap-1 text-cyan-300"><div className="w-2 h-2 bg-cyan-400" /> LOAD</span>
          <span className="flex items-center gap-1 text-red-400"><div className="w-2 h-2 bg-red-500" /> GRID</span>
        </div>
      </div>
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.5}/><stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/><stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorGrid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={12} tickMargin={10} tick={{ fill: '#64748b' }} />
            <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`} tick={{ fill: '#64748b' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
              itemStyle={{ fontSize: '14px' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              formatter={(value: unknown, name: unknown) => {
                const numericValue = typeof value === 'number' ? value : Number(value) || 0;
                const nameStr = String(name ?? '');
                if (nameStr === 'Battery Level') return [`${(numericValue / 50).toFixed(0)}%`, nameStr];
                return [`${numericValue.toFixed(0)} W`, nameStr];
              }}
            />
            <Area type="monotone" dataKey="solarPower" name="Solar (W)" stroke="#fbbf24" strokeWidth={2} fill="url(#colorSolar)" isAnimationActive={false} />
            <Area type="monotone" dataKey="gridImport" name="Grid Import (W)" stroke="#ef4444" strokeWidth={2} fill="url(#colorGrid)" isAnimationActive={false} />
            <Line type="monotone" dataKey="homeConsumption" name="Home Load (W)" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey={(d: SolarData) => d.batteryState * 50} name="Battery Level" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const HUD = () => {
  const { latestStat, totalSaved, simTime, isEngineActive } = useSolarSystem();
  const isNight = simTime < 6 || simTime >= 18;
  
  return (
    <div className="absolute top-6 left-6 z-40 bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-3 pointer-events-none">
      <div className="flex items-center gap-4">
        <span className="text-4xl font-mono font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-lg tabular-nums">
          {latestStat.timeLabel}
        </span>
        <div className="flex flex-col text-[10px] text-white/60 font-bold uppercase tracking-widest gap-1">
          <span className={`px-2 py-0.5 rounded-full border ${isNight ? 'border-indigo-500/30 bg-indigo-500/20 text-indigo-300' : 'border-amber-500/30 bg-amber-500/20 text-amber-300'}`}>
            {isNight ? 'NIGHT CYCLE' : 'DAY CYCLE'}
          </span>
          {isEngineActive ? (
            <span className="text-emerald-400 flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_5px_#34d399]"></span>
              ENGINE: ACTIVE
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-500/30">
              <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
              ENGINE: PAUSED
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-white/20 to-transparent w-full"></div>
      <div className="text-xs font-mono text-cyan-200 flex justify-between items-center bg-cyan-950/30 p-2 rounded-lg border border-cyan-500/20">
        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> TOTAL SAVED</span>
        <span className="font-bold text-white text-sm">฿ {totalSaved.toFixed(2)}</span>
      </div>
    </div>
  );
};

const NILMSensor = () => {
  const { appliances } = useSolarSystem();
  const activeAppliances = appliances.filter(a => a.isOn && a.id !== 'fridge');
  
  const isAcOn = appliances.find(a => a.id === 'ac')?.isOn;
  const isLightOn = appliances.find(a => a.id === 'light')?.isOn;
  const isTvOn = appliances.find(a => a.id === 'tv')?.isOn;

  const getWaveform = () => {
    if (isAcOn) return "M0 10 Q 5 -5, 10 10 T 20 10 T 30 10 Q 35 25, 40 10 T 50 10 Q 55 -5, 60 10 T 70 10 T 80 10 Q 85 25, 90 10 T 100 10"; 
    if (isTvOn || isLightOn) return "M0 10 L 10 10 L 15 2 L 20 10 L 30 10 L 35 18 L 40 10 L 50 10 L 55 2 L 60 10 L 70 10 L 75 18 L 80 10 L 100 10"; 
    return "M0 10 Q 10 5, 20 10 T 40 10 T 60 10 Q 70 15, 80 10 T 100 10"; 
  };

  return (
    <div className="absolute right-6 top-6 z-40">
      <div className="w-56 bg-slate-900/80 backdrop-blur-xl border border-indigo-500/50 p-4 rounded-xl shadow-[0_0_25px_rgba(99,102,241,0.2)] flex flex-col gap-3 relative">
        <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
          <span className="text-[10px] font-bold text-indigo-300 tracking-widest flex items-center gap-1">
            <Activity className="w-3 h-3"/> NILM AI CORE
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></div>
        </div>
        
        <div className="h-12 w-full bg-black/80 rounded border border-indigo-500/30 overflow-hidden relative flex items-center shadow-inner">
          <motion.div 
            className="absolute top-0 bottom-0 w-[50%] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"
            animate={{ left: ['-50%', '150%'] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          />
          <svg viewBox="0 0 100 20" className="w-full h-full stroke-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.9)]" fill="none" strokeWidth="1.5">
            <motion.path 
              d={getWaveform()} 
              animate={{ x: [-20, 0] }} 
              transition={{ repeat: Infinity, duration: isAcOn ? 0.2 : 0.8, ease: "linear" }}
            />
          </svg>
        </div>
        
        <div className="text-[9px] text-slate-400 font-mono mt-1">AI LOAD SIGNATURE:</div>
        <div className="flex flex-wrap gap-1.5 min-h-[20px]">
           {activeAppliances.length === 0 && <span className="text-[9px] text-teal-500 font-mono">- BASE LOAD -</span>}
           {activeAppliances.map(app => (
             <div key={app.id} className="bg-indigo-900/80 text-indigo-100 text-[9px] px-2 py-0.5 rounded border border-indigo-400/80 flex items-center shadow-[0_0_8px_rgba(99,102,241,0.5)] font-bold">
                {app.name}
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

const ControlPanel = () => {
  const { latestStat, appliances, toggleAppliance, weatherMode, setWeatherMode, isEngineActive, toggleEngine, simTime, setTime, isAiAutoMode, toggleAiAutoMode, saveSession, isSaving } = useSolarSystem();

  return (
    <div className="flex flex-col gap-6 w-full lg:w-1/3">
      {/* Weather & Time Control Panel */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
        <div>
          <div className="flex justify-between items-center mb-4 text-white/70">
            <span className="flex gap-2 text-sm font-semibold"><CloudLightning className="w-5 h-5 text-fuchsia-400" /> ENVIRONMENT</span>
            <select
              value={useSolarSystem().selectedHouseId}
              onChange={(e) => useSolarSystem().setSelectedHouseId(e.target.value)}
              className="bg-black/50 border border-white/10 text-xs font-bold text-slate-300 rounded-lg px-2 py-1 outline-none"
            >
              {useSolarSystem().houses.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setWeatherMode('NORMAL')} className={`flex flex-col items-center p-3 rounded-xl border transition-all ${weatherMode === 'NORMAL' ? 'bg-fuchsia-500/20 border-fuchsia-400/50 text-fuchsia-300' : 'bg-black/40 border-white/5 text-white/50 hover:bg-white/5'}`}>
              <Sun className="w-6 h-6 mb-2" />
              <span className="text-xs font-bold">Normal Day</span>
            </button>
            <button onClick={() => setWeatherMode('OVERLOAD')} className={`flex flex-col items-center p-3 rounded-xl border transition-all ${weatherMode === 'OVERLOAD' ? 'bg-amber-500/20 border-amber-400/50 text-amber-300' : 'bg-black/40 border-white/5 text-white/50 hover:bg-white/5'}`}>
              <SunMedium className="w-6 h-6 mb-2" />
              <span className="text-xs font-bold">Sun Overload</span>
            </button>
            <button onClick={() => setWeatherMode('CLOUDY')} className={`flex flex-col items-center p-3 rounded-xl border transition-all ${weatherMode === 'CLOUDY' ? 'bg-slate-500/40 border-slate-400/80 text-slate-200' : 'bg-black/40 border-white/5 text-white/50 hover:bg-white/5'}`}>
              <CloudLightning className="w-6 h-6 mb-2" />
              <span className="text-xs font-bold">Cloudy Day</span>
            </button>
            <button onClick={() => setWeatherMode('STORM')} className={`flex flex-col items-center p-3 rounded-xl border transition-all ${weatherMode === 'STORM' ? 'bg-indigo-500/40 border-indigo-400/80 text-indigo-300' : 'bg-black/40 border-white/5 text-white/50 hover:bg-white/5'}`}>
              <CloudRain className="w-6 h-6 mb-2" />
              <span className="text-xs font-bold">Storm Mode</span>
            </button>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-4">
          <div className="flex justify-between mb-2 text-white/70">
            <span className="flex gap-2 text-sm font-semibold">TIME SIMULATION</span>
            <button onClick={toggleEngine} className={`text-xs font-bold px-3 py-1 rounded-full border ${isEngineActive ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'}`}>
              {isEngineActive ? 'PAUSE' : 'PLAY'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/50">00:00</span>
            <input 
              type="range" 
              min="0" 
              max="23.99" 
              step="0.1" 
              value={simTime}
              onChange={(e) => {
                if(isEngineActive) toggleEngine();
                setTime(parseFloat(e.target.value));
              }}
              className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-xs font-mono text-white/50">23:59</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-indigo-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.15)] flex justify-between items-center">
        <div>
           <div className="flex items-center gap-2 font-bold text-indigo-400 mb-1"><BrainCircuit className="w-5 h-5"/> AI AUTO-PILOT</div>
           <div className="text-xs text-slate-400">Autonomous energy management</div>
        </div>
        <button onClick={toggleAiAutoMode} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isAiAutoMode ? 'bg-indigo-500' : 'bg-slate-700'}`}>
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isAiAutoMode ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Appliance Control Card */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-xl">
        <div className="flex justify-between mb-4 text-white/70">
          <span className="flex gap-2 text-sm font-semibold"><Power className="w-5 h-5 text-cyan-400" /> SMART HOME</span>
          <span className="text-xs font-mono text-cyan-300 bg-cyan-900/40 px-2 py-1 rounded">{(latestStat.homeConsumption / 1000).toFixed(2)} kW</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {appliances.map(app => {
            const Icon = app.icon;
            return (
            <button key={app.id} onClick={() => toggleAppliance(app.id)} className={`flex flex-col gap-3 p-3 rounded-xl border transition-all text-left ${app.isOn ? 'bg-cyan-500/10 border-cyan-400/50' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}>
              <div className="flex justify-between w-full">
                <div className={`p-2 rounded-lg ${app.isOn ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-white/40'}`}><Icon className="w-4 h-4" /></div>
                <div className={`w-8 h-4 rounded-full relative border ${app.isOn ? 'bg-cyan-500 border-cyan-400' : 'bg-slate-800 border-slate-700'}`}>
                  <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${app.isOn ? 'left-[18px]' : 'left-1'}`}></div>
                </div>
              </div>
              <div>
                <div className={`text-xs font-bold ${app.isOn ? 'text-white' : 'text-white/50'}`}>{app.name}</div>
                <div className={`text-[10px] font-mono ${app.isOn ? 'text-cyan-200' : 'text-white/30'}`}>{Math.round(app.power)}W</div>
              </div>
            </button>
          )})}
        </div>
      </div>

      {/* Save & Analytics */}
      <div className="flex gap-3">
        <button 
          onClick={saveSession} 
          disabled={isSaving}
          className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-emerald-500/30 text-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Session'}
        </button>
        <Link href="/summary" className="flex-1 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-fuchsia-500/30 text-sm">
          <BarChart3 className="w-4 h-4" /> View Summary
        </Link>
      </div>

    </div>
  );
};

const AiTerminal = () => {
  const { aiLogs } = useSolarSystem();

  return (
    <div className="flex-1 bg-black/60 backdrop-blur-xl border border-indigo-500/20 p-5 rounded-2xl shadow-xl flex flex-col h-[400px]">
      <div className="flex justify-between items-center border-b border-indigo-500/20 pb-3 mb-3">
        <h2 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4"/> AI TERMINAL LOGS
        </h2>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[11px] flex flex-col gap-2 pr-2 custom-scrollbar">
        {aiLogs.length === 0 ? (
          <div className="text-slate-500 italic mt-2">Waiting for AI actions... Turn on AI Auto-Pilot.</div>
        ) : (
          aiLogs.map((log) => (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={log.id} className={`p-2 rounded border ${
              log.type === 'warn' ? 'bg-amber-950/30 border-amber-500/30 text-amber-300' :
              log.type === 'info' ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-300' :
              'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
            }`}>
              <span className="opacity-50 mr-2">[{log.timeLabel}]</span>
              {log.message}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const DashboardContent = () => {
  
  return (
    <div className="min-h-screen bg-black font-sans text-slate-100 flex flex-col selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Zone 1: Scene (The Game) */}
      <div className="relative w-full h-[60vh] min-h-[500px] overflow-hidden rounded-b-[2.5rem] flex-shrink-0 border-b border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <HUD />
        <NILMSensor />
        <SolarScene3D />
      </div>

      {/* Zone 2: Dashboard Controls & Analytics */}
      <div className="flex-1 bg-[#020617] p-6 lg:p-8 flex flex-col lg:flex-row gap-6 relative z-10 w-full max-w-[1400px] mx-auto">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <ControlPanel />
        <div className="flex-1 flex flex-col gap-6">
          <AnalyticsChart />
          <AiTerminal />
        </div>
      </div>
    </div>
  );
};

export default function SolarApp() {
  const solarState = useSolarEngine();

  return (
    <SolarContext.Provider value={solarState}>
      <DashboardContent />
    </SolarContext.Provider>
  );
}