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

  useEffect(() => {
    let lastTime = performance.now();
    const tickRateMs = 500; // Update React state twice a second

    const intervalId = setInterval(() => {
      const time = performance.now();
      const deltaTime = time - lastTime;
      lastTime = time;

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

      if (netPower < 0 && current.batteryLevel <= 20) {
        // Smart Grid Backup: Import grid when battery is critically low (<=20%) and solar cannot meet load.
        gridImport = Math.abs(netPower);
        // Battery level stays the same (bypassed)
      } else {
        newBattery += (energyDeltaWh / CONFIG.BATTERY_CAPACITY) * 100;
        if (newBattery < 0) {
          gridImport = Math.abs(netPower);
          newBattery = 0;
        }
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

      if (!current.isEngineActive) {
        return;
      }

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

      // --- AI AUTO-PILOT LOGIC ---
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
        else if (newBattery > 80 && isGoodWeather && isDayTime && netPower > 500) {
          const ac = newAppliances.find(a => a.id === 'ac');
          if (ac && !ac.isOn) {
            newAppliances = newAppliances.map(a => a.id === 'ac' ? { ...a, isOn: true } : a);
            newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `☀️ Excess solar (${Math.floor(netPower)}W surplus). Pre-cooling house.`, type: 'info' as const });
            actionsThisPass++;
          }
        }
        
        if (isDayTime && isGoodWeather) {
          const light = newAppliances.find(a => a.id === 'light');
          if (light && light.isOn) {
            newAppliances = newAppliances.map(a => a.id === 'light' ? { ...a, isOn: false } : a);
            newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `💡 Daylight detected. Turning off indoor lights.`, type: 'info' as const });
            actionsThisPass++;
          }
        }
        
        if (actionsThisPass === 0) {
          newAiLogs.unshift({ id: nextAiLogId(), timeLabel, message: `✅ All systems nominal. Battery: ${Math.floor(newBattery)}%, Solar: ${Math.floor(solarProd)}W, Load: ${Math.floor(currentHomeLoad)}W.`, type: 'success' as const });
        }
        
        if (newAiLogs.length > 50) newAiLogs = newAiLogs.slice(0, 50);
      }

      setState(prev => {
        const newHist = [...prev.dataHistory, stat];
        if (newHist.length > 50) newHist.shift(); 
        
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

      // --- AUTO-LOG every 5 sim-hours ---
      const hoursSinceAutoLog = ((nextHour - autoLogLastHourRef.current) + 24) % 24;
      if (autoLogLastHourRef.current < 0 || hoursSinceAutoLog >= 5) {
        autoLogLastHourRef.current = nextHour;
        fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simTime: nextHour,
            simTimeLabel: makeTimeLabel(nextHour),
            batteryLevel: newBattery,
            totalSaved: current.totalSaved,
            weatherMode: current.weatherMode,
            solarPower: solarProd,
            homeConsumption: currentHomeLoad,
            gridImport: gridImport,
            appliances: current.appliances.map(a => ({ id: a.id, name: a.name, isOn: a.isOn, power: a.power })),
            aiAutoMode: current.isAiAutoMode,
            aiActionsCount: current.aiLogs.length,
            houseId: current.selectedHouseId,
          }),
        }).catch(() => {});
      }

    }, tickRateMs);

    return () => clearInterval(intervalId);
  }, []);

  // Calculate instantaneous stats so UI updates immediately when buttons are pressed, even if engine is paused.
  let instantLoad = 100; // Base load
  state.appliances.forEach(app => {
    if (app.isOn) instantLoad += app.power;
  });

  let instantSolar = 0;
  if (state.simTime > 6 && state.simTime < 18) {
    const progress = (state.simTime - 6) / 12;
    const curve = Math.sin(progress * Math.PI);
    let modifier = 1;
    if (state.weatherMode === 'OVERLOAD') modifier = 1.2;
    else if (state.weatherMode === 'CLOUDY') modifier = 0.4;
    else if (state.weatherMode === 'STORM') modifier = 0;
    instantSolar = Math.max(0, CONFIG.SOLAR_MAX * (curve * modifier));
  }

  const netPower = instantSolar - instantLoad;
  let instantGrid = 0;
  if (netPower < 0 && state.batteryLevel <= 20) {
    instantGrid = Math.abs(netPower);
  } else if (netPower < 0 && state.batteryLevel <= 0) {
    instantGrid = Math.abs(netPower);
  }

  const latestStat: SolarData = {
    hour: state.simTime,
    timeLabel: makeTimeLabel(state.simTime),
    solarPower: instantSolar,
    homeConsumption: instantLoad,
    batteryState: state.batteryLevel,
    gridImport: instantGrid,
  };

  return { ...state, toggleAppliance, setWeatherMode, toggleEngine, setTime, toggleAiAutoMode, saveSession, setSelectedHouseId, latestStat, isSaving };
};

// --- COMPONENTS ---

const AnalyticsChart = () => {
  const { dataHistory } = useSolarSystem();
  const chartData = useMemo(() => dataHistory, [dataHistory]);

  return (
    <div className="bg-white/80 backdrop-blur-2xl border border-white p-5 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.05)] flex flex-col w-full h-[320px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold text-slate-800 flex gap-1.5 items-center"><Activity className="w-4 h-4 text-slate-400" /> Power Flow</h2>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorGrid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={10} tickMargin={8} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#1e293b', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              labelStyle={{ color: '#64748b', marginBottom: '4px', fontSize: '11px' }}
              formatter={(value: unknown, name: unknown) => {
                const numericValue = typeof value === 'number' ? value : Number(value) || 0;
                const nameStr = String(name ?? '');
                if (nameStr === 'Battery Level') return [`${(numericValue / 50).toFixed(0)}%`, nameStr];
                return [`${numericValue.toFixed(0)} W`, nameStr];
              }}
            />
            <Area type="monotone" dataKey="solarPower" name="Solar (W)" stroke="#f59e0b" strokeWidth={2} fill="url(#colorSolar)" isAnimationActive={false} />
            <Area type="monotone" dataKey="gridImport" name="Grid Import (W)" stroke="#ef4444" strokeWidth={2} fill="url(#colorGrid)" isAnimationActive={false} />
            <Line type="monotone" dataKey="homeConsumption" name="Home Load (W)" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey={(d: SolarData) => d.batteryState * 50} name="Battery Level" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const HUD = () => {
  const { latestStat, totalSaved, simTime } = useSolarSystem();
  const isNight = simTime < 6 || simTime >= 18;
  
  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-white/70 backdrop-blur-2xl px-8 py-3 rounded-full border border-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.05)] flex items-center gap-8 pointer-events-none">
      <div className="flex flex-col items-center">
        <span className="text-3xl font-light tracking-tighter text-slate-800 tabular-nums leading-none">
          {latestStat.timeLabel}
        </span>
        <span className="text-[9px] font-bold text-slate-400 tracking-widest mt-1">
          {isNight ? 'NIGHT CYCLE' : 'DAY CYCLE'}
        </span>
      </div>
      
      <div className="w-px h-8 bg-slate-200" />
      
      <div className="flex gap-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 tracking-widest">SOLAR</span>
          <span className="text-lg font-semibold text-amber-500 tabular-nums leading-tight">{latestStat.solarPower.toFixed(0)} W</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 tracking-widest">LOAD</span>
          <span className="text-lg font-semibold text-sky-500 tabular-nums leading-tight">{latestStat.homeConsumption.toFixed(0)} W</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 tracking-widest">SAVED</span>
          <span className="text-lg font-semibold text-emerald-500 tabular-nums leading-tight">฿{totalSaved.toFixed(0)}</span>
        </div>
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
    <div className="bg-white/80 backdrop-blur-2xl border border-white p-4 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.05)] flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-[10px] font-bold text-slate-500 tracking-widest flex items-center gap-1">
          <Activity className="w-3 h-3"/> NILM SENSOR
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
      </div>
      
      <div className="h-10 w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative flex items-center">
        <motion.div 
          className="absolute top-0 bottom-0 w-[50%] bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent"
          animate={{ left: ['-50%', '150%'] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        />
        <svg viewBox="0 0 100 20" className="w-full h-full stroke-indigo-400" fill="none" strokeWidth="1.5">
          <motion.path 
            d={getWaveform()} 
            animate={{ x: [-20, 0] }} 
            transition={{ repeat: Infinity, duration: isAcOn ? 0.2 : 0.8, ease: "linear" }}
          />
        </svg>
      </div>
      
      <div className="flex flex-wrap gap-1.5 min-h-[20px]">
         {activeAppliances.length === 0 && <span className="text-[9px] text-slate-400 font-medium italic">Base load only</span>}
         {activeAppliances.map(app => (
           <div key={app.id} className="bg-white text-slate-700 text-[9px] px-2 py-0.5 rounded-full border border-slate-200 font-bold shadow-sm">
              {app.name}
           </div>
         ))}
      </div>
    </div>
  );
};

const WeatherControls = () => {
  const { weatherMode, setWeatherMode } = useSolarSystem();
  return (
    <div className="absolute top-6 left-6 z-40 bg-white/70 backdrop-blur-2xl p-1.5 rounded-full border border-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.05)] flex gap-1 pointer-events-auto">
      <button onClick={() => setWeatherMode('NORMAL')} className={`p-2 rounded-full transition-colors ${weatherMode === 'NORMAL' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
        <Sun className="w-4 h-4" />
      </button>
      <button onClick={() => setWeatherMode('OVERLOAD')} className={`p-2 rounded-full transition-colors ${weatherMode === 'OVERLOAD' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
        <SunMedium className="w-4 h-4" />
      </button>
      <button onClick={() => setWeatherMode('CLOUDY')} className={`p-2 rounded-full transition-colors ${weatherMode === 'CLOUDY' ? 'bg-slate-400 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
        <CloudLightning className="w-4 h-4" />
      </button>
      <button onClick={() => setWeatherMode('STORM')} className={`p-2 rounded-full transition-colors ${weatherMode === 'STORM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
        <CloudRain className="w-4 h-4" />
      </button>
    </div>
  );
};

const TopRightControls = () => {
  const { houses, selectedHouseId, setSelectedHouseId } = useSolarSystem();
  return (
    <div className="absolute top-6 right-6 z-40 flex items-center gap-3 pointer-events-auto">
      <select
        value={selectedHouseId}
        onChange={(e) => setSelectedHouseId(e.target.value)}
        className="bg-white/70 backdrop-blur-2xl border border-white/60 text-xs font-bold text-slate-600 rounded-full px-4 py-2.5 outline-none shadow-[0_10px_30px_rgba(0,0,0,0.05)] appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[length:10px]"
      >
        {houses.map(h => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
      <Link href="/summary" className="bg-white/70 backdrop-blur-2xl border border-white/60 p-2.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.05)] text-slate-500 hover:text-indigo-500 transition-colors">
        <BarChart3 className="w-4 h-4" />
      </Link>
    </div>
  );
};

const ControlPanel = () => {
  const { appliances, toggleAppliance, isEngineActive, toggleEngine, simTime, setTime, isAiAutoMode, toggleAiAutoMode, saveSession, isSaving } = useSolarSystem();

  return (
    <div className="bg-white/80 backdrop-blur-2xl border border-white p-4 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex items-center justify-between gap-6 w-full transition-all">
      {/* Appliances quick toggles */}
      <div className="flex gap-2">
        {appliances.map(app => {
          const Icon = app.icon;
          return (
            <button key={app.id} onClick={() => toggleAppliance(app.id)} className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${app.isOn ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}>
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[9px] font-bold tracking-tight">{app.name.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>

      <div className="w-px h-12 bg-slate-200" />

      {/* Time & Engine */}
      <div className="flex-1 flex flex-col justify-center px-4">
         <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 tracking-wider">TIME / SIMULATION</span>
            <button onClick={toggleEngine} className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${isEngineActive ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
              {isEngineActive ? 'PAUSE' : 'PLAY'}
            </button>
         </div>
         <input 
            type="range" 
            min="0" max="23.99" step="0.1" 
            value={simTime}
            onChange={(e) => {
              if(isEngineActive) toggleEngine();
              setTime(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-800"
          />
      </div>

      <div className="w-px h-12 bg-slate-200" />

      {/* AI Auto Pilot */}
      <div className="flex items-center gap-3 px-2">
         <div className="flex flex-col items-end">
           <span className="text-xs font-bold text-slate-800 flex items-center gap-1"><BrainCircuit className="w-3 h-3"/> AI PILOT</span>
           <span className="text-[10px] text-slate-500 font-medium">Auto Energy</span>
         </div>
         <button onClick={toggleAiAutoMode} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isAiAutoMode ? 'bg-indigo-500' : 'bg-slate-300'}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${isAiAutoMode ? 'translate-x-6' : 'translate-x-1'}`} />
         </button>
      </div>

      {/* Save Button */}
      <button onClick={saveSession} disabled={isSaving} className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex flex-col items-center justify-center hover:bg-emerald-100 transition-colors shadow-sm disabled:opacity-50 ml-2">
        <Save className="w-5 h-5 mb-1" />
        <span className="text-[9px] font-bold tracking-tight">SAVE</span>
      </button>
    </div>
  );
};

const AiTerminal = () => {
  const { aiLogs } = useSolarSystem();

  return (
    <div className="bg-white/80 backdrop-blur-2xl border border-white p-5 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.05)] flex flex-col h-[280px]">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-500"/> AI LOGS
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[10px] flex flex-col gap-2 pr-2 custom-scrollbar">
        {aiLogs.length === 0 ? (
          <div className="text-slate-400 italic mt-2 text-center">AI Auto-Pilot is idle.</div>
        ) : (
          aiLogs.map((log) => (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} key={log.id} className={`p-2 rounded-xl border ${
              log.type === 'warn' ? 'bg-orange-50 border-orange-200 text-orange-700' :
              log.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' :
              'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <span className="opacity-50 mr-2 font-semibold">[{log.timeLabel}]</span>
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
    <div className="relative w-full h-screen bg-[#f1f5f9] font-sans text-slate-800 overflow-hidden flex flex-col selection:bg-indigo-100">
      {/* Zone 1: Scene - Full Screen Background */}
      <div className="absolute inset-0 z-0">
        <SolarScene3D />
      </div>

      {/* Floating HUD & Top Controls */}
      <WeatherControls />
      <HUD />
      <TopRightControls />
      
      {/* Floating Side Panels (Right) */}
      <div className="absolute top-28 right-6 z-10 flex flex-col gap-4 w-96 pointer-events-auto h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar pb-10">
        <AnalyticsChart />
        <NILMSensor />
        <AiTerminal />
      </div>

      {/* Bottom Dock Control Panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4 pointer-events-auto">
        <ControlPanel />
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