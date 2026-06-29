'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { signOut } from "next-auth/react";
import { Activity, Zap, Sun, BatteryCharging, CloudLightning, ArrowLeft, Trash2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface SessionLog {
  id: string;
  timestamp: string;
  simTime: number;
  simTimeLabel: string;
  batteryLevel: number;
  totalSaved: number;
  weatherMode: string;
  solarPower: number;
  homeConsumption: number;
  gridImport: number;
  appliances: { id: string; name: string; isOn: boolean; power: number }[];
  aiAutoMode: boolean;
  aiActionsCount: number;
}

const weatherLabel: Record<string, string> = {
  NORMAL: '☀️ Normal',
  OVERLOAD: '🔥 Overload',
  CLOUDY: '☁️ Cloudy',
  STORM: '⛈️ Storm',
};

const colorMap: Record<string, { border: string; text: string }> = {
  cyan: { border: 'border-cyan-500/30', text: 'text-cyan-400' },
  emerald: { border: 'border-emerald-500/30', text: 'text-emerald-400' },
  amber: { border: 'border-amber-500/30', text: 'text-amber-400' },
  fuchsia: { border: 'border-fuchsia-500/30', text: 'text-fuchsia-400' },
};

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) => {
  const c = colorMap[color] ?? colorMap.cyan;
  return (
    <div className={`bg-slate-900/60 backdrop-blur-xl border ${c.border} p-5 rounded-2xl shadow-xl flex flex-col gap-2`}>
      <div className={`flex items-center gap-2 ${c.text} text-sm font-bold`}>
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-3xl font-bold text-white font-mono tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
};

export default function SummaryPage() {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(); 
  }, []);

  // Aggregated stats
  const stats = useMemo(() => {
    if (logs.length === 0) return null;
    const totalSaved = logs.reduce((sum, l) => sum + l.totalSaved, 0);
    const avgBattery = logs.reduce((sum, l) => sum + l.batteryLevel, 0) / logs.length;
    const peakSolar = Math.max(...logs.map(l => l.solarPower));
    const avgLoad = logs.reduce((sum, l) => sum + l.homeConsumption, 0) / logs.length;
    const weatherCounts: Record<string, number> = {};
    logs.forEach(l => { weatherCounts[l.weatherMode] = (weatherCounts[l.weatherMode] || 0) + 1; });
    const topWeather = Object.entries(weatherCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'NORMAL';
    const aiSessions = logs.filter(l => l.aiAutoMode).length;
    const totalAiActions = logs.reduce((sum, l) => sum + l.aiActionsCount, 0);

    return { totalSaved, avgBattery, peakSolar, avgLoad, topWeather, aiSessions, totalAiActions };
  }, [logs]);

  // Chart data (last 30 entries)
  const chartData = useMemo(() => {
    return logs.slice(-30).map((l, i) => ({
      index: i + 1,
      label: new Date(l.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      solar: Math.round(l.solarPower),
      load: Math.round(l.homeConsumption),
      battery: Math.round(l.batteryLevel),
      saved: parseFloat(l.totalSaved.toFixed(2)),
    }));
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#020617] font-sans text-slate-100 selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-fuchsia-400" /> Session Analytics
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-4">
              <Link 
                href="/"
                className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-6 rounded-lg transition-colors border border-slate-700 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
              <button 
                onClick={() => signOut({ callbackUrl: '/' })}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-2 px-6 rounded-lg transition-colors border border-red-500/30 flex items-center gap-2"
              >
                Logout
              </button>
            </div>
            <span className="text-xs text-slate-500 font-mono">{logs.length} sessions logged</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Glow effects */}
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

        {loading && (
          <div className="text-center py-20 text-slate-400 text-lg">Loading session data...</div>
        )}

        {error && (
          <div className="bg-rose-950/30 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-sm">{error}</div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <Activity className="w-12 h-12 text-slate-600" />
            <div className="text-slate-400 text-lg">No sessions recorded yet.</div>
            <div className="text-slate-500 text-sm">Go back to the simulator and click &quot;Save Session&quot; to start logging data.</div>
            <Link href="/" className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
              Open Simulator
            </Link>
          </div>
        )}

        {!loading && stats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Zap} label="TOTAL SAVED" value={`฿${stats.totalSaved.toFixed(2)}`} sub={`Across ${logs.length} sessions`} color="cyan" />
              <StatCard icon={BatteryCharging} label="AVG BATTERY" value={`${stats.avgBattery.toFixed(0)}%`} sub={`Peak solar: ${stats.peakSolar.toFixed(0)}W`} color="emerald" />
              <StatCard icon={Sun} label="AVG LOAD" value={`${stats.avgLoad.toFixed(0)}W`} sub={`AI sessions: ${stats.aiSessions}`} color="amber" />
              <StatCard icon={CloudLightning} label="TOP WEATHER" value={weatherLabel[stats.topWeather] ?? stats.topWeather} sub={`${stats.totalAiActions} AI actions total`} color="fuchsia" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Solar & Load Chart */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-400" /> Solar vs Load (Last 30)
                </h2>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sSolar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} /><stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="sLoad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={10} tick={{ fill: '#64748b' }} />
                      <YAxis stroke="#64748b" fontSize={10} tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }} />
                      <Area type="monotone" dataKey="solar" name="Solar (W)" stroke="#fbbf24" strokeWidth={2} fill="url(#sSolar)" />
                      <Area type="monotone" dataKey="load" name="Load (W)" stroke="#22d3ee" strokeWidth={2} fill="url(#sLoad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Battery & Savings Chart */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BatteryCharging className="w-4 h-4 text-emerald-400" /> Battery Level (Last 30)
                </h2>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={10} tick={{ fill: '#64748b' }} />
                      <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }} />
                      <Bar dataKey="battery" name="Battery (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Session History Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-slate-400" /> Session History
                </h2>
                <span className="text-xs text-slate-500 font-mono">{logs.length} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="text-left py-3 px-2">Timestamp</th>
                      <th className="text-left py-3 px-2">Sim Time</th>
                      <th className="text-left py-3 px-2">Weather</th>
                      <th className="text-right py-3 px-2">Battery</th>
                      <th className="text-right py-3 px-2">Solar</th>
                      <th className="text-right py-3 px-2">Load</th>
                      <th className="text-right py-3 px-2">Grid</th>
                      <th className="text-right py-3 px-2">Saved (฿)</th>
                      <th className="text-center py-3 px-2">AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...logs].reverse().map(log => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-2 text-slate-300">
                          {new Date(log.timestamp).toLocaleString('th-TH', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>
                        <td className="py-2.5 px-2 text-white font-bold">{log.simTimeLabel}</td>
                        <td className="py-2.5 px-2">{weatherLabel[log.weatherMode] ?? log.weatherMode}</td>
                        <td className={`py-2.5 px-2 text-right font-bold ${log.batteryLevel > 50 ? 'text-emerald-400' : log.batteryLevel > 20 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {log.batteryLevel.toFixed(0)}%
                        </td>
                        <td className="py-2.5 px-2 text-right text-amber-300">{log.solarPower.toFixed(0)}W</td>
                        <td className="py-2.5 px-2 text-right text-cyan-300">{log.homeConsumption.toFixed(0)}W</td>
                        <td className="py-2.5 px-2 text-right text-rose-400">{log.gridImport.toFixed(0)}W</td>
                        <td className="py-2.5 px-2 text-right text-white">{log.totalSaved.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-center">
                          {log.aiAutoMode ? (
                            <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-bold">ON</span>
                          ) : (
                            <span className="bg-slate-700/50 text-slate-500 px-2 py-0.5 rounded-full text-[10px]">OFF</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
