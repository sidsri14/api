import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Clock, Activity, CheckCircle, XCircle, AlertCircle, 
  ExternalLink, BarChart3, History, Shield
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Log {
  id: string;
  monitorId: string;
  statusCode?: number;
  responseTime?: number;
  status: string;
  createdAt: string;
}

interface Incident {
  id: string;
  startedAt: string;
  resolvedAt: string | null;
  durationSecs: number | null;
  cause: string | null;
}

interface Monitor {
  id: string;
  name?: string;
  url: string;
  method: string;
  interval: number;
  status: string;
  lastCheckedAt: string | null;
  logs: Log[];
  incidents: Incident[];
  uptime30d?: number;
}

const MonitorDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: monitor, isLoading, isError, error } = useQuery({
    queryKey: ['monitor', id],
    queryFn: async () => {
      const { data } = await api.get(`/monitors/${id}`);
      return data.data as Monitor;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  if (isLoading && !monitor) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 glass rounded-2xl" />)}
        </div>
        <div className="h-96 glass rounded-2xl" />
      </div>
    );
  }

  if (isError || !monitor) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-black">Data Fetch Failed</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm font-medium">
          { (error as any)?.response?.data?.error || "We couldn't retrieve the details for this monitor. Please check your connection."}
        </p>
        <Link to="/" className="btn-primary">
          <ArrowLeft className="w-4 h-4" /> Back to Safety
        </Link>
      </div>
    );
  }

  const chartData = [...(monitor.logs || [])].reverse().map((log) => ({
    time: new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullTime: new Date(log.createdAt).toLocaleString(),
    responseTime: log.responseTime || 0,
    status: log.status
  }));

  const avgResponseTime = chartData.length > 0 
    ? Math.round(chartData.reduce((acc, log) => acc + log.responseTime, 0) / chartData.length)
    : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8 pb-12"
    >
      {/* ── Header Area */}
      <div>
        <Link 
          to="/" 
          className="group inline-flex items-center text-sm font-black text-slate-500 hover:text-primary-500 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
          BACK TO DASHBOARD
        </Link>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-black tracking-tight">{monitor.name || "Unnamed Monitor"}</h1>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border",
                monitor.status === 'UP' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
              )}>
                {monitor.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm font-bold text-slate-500">
              <span className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                <a href={monitor.url} target="_blank" rel="noreferrer" className="hover:text-primary-500 transition-colors underline decoration-dotted underline-offset-4">
                  {monitor.url}
                </a>
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase text-[10px] tracking-widest">
                {monitor.method}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Checks every {monitor.interval}s
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button className="btn-primary bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
              <Activity className="w-4 h-4" /> Run Manual Check
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Status</p>
          <div className={cn(
            "text-2xl font-black",
            monitor.status === 'UP' ? "text-emerald-500" : "text-red-500"
          )}>{monitor.status}</div>
        </div>
        <div className="glass-card">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Avg Latency</p>
          <div className="text-2xl font-black">{avgResponseTime}<span className="text-sm font-medium text-slate-400 ml-1">ms</span></div>
        </div>
        <div className="glass-card">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Uptime 30D</p>
          <div className="text-2xl font-black text-primary-500">{monitor.uptime30d ?? 100}%</div>
        </div>
        <div className="glass-card">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Logs</p>
          <div className="text-2xl font-black">{monitor.logs?.length || 0}</div>
        </div>
      </div>

      {/* ── Visualization */}
      <div className="glass-card p-0 overflow-hidden bg-white/40 dark:bg-slate-900/40">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-black text-sm tracking-widest flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-500" /> PERFORMANCE OVER TIME
          </h3>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-500" /> Latency</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Stable</span>
          </div>
        </div>
        <div className="h-80 w-full p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.1} />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} 
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} 
                unit="ms"
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="glass p-3 rounded-xl border-slate-200 shadow-2xl">
                        <p className="text-[10px] font-black text-slate-400 mb-1">{payload[0].payload.fullTime}</p>
                        <p className="text-sm font-black text-primary-500">{payload[0].value}ms Response</p>
                        <p className={cn(
                          "text-[10px] font-bold mt-1",
                          payload[0].payload.status === 'UP' ? "text-emerald-500" : "text-red-500"
                        )}>Status: {payload[0].payload.status}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={avgResponseTime} stroke="#64748b" strokeDasharray="3 3" label={{ position: 'right', value: 'Avg', fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
              <Area 
                type="monotone" 
                dataKey="responseTime" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorLatency)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Incident History */}
        <div className="glass rounded-2xl overflow-hidden self-start">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <h3 className="font-black text-sm tracking-widest flex items-center gap-2 uppercase">
              <Shield className="w-4 h-4 text-red-500" /> Incident History
            </h3>
            <span className="text-[10px] font-black text-slate-400 tracking-tighter">LAST 20 EVENTS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800/50">
                  <th className="p-4 pl-6">Event</th>
                  <th className="p-4">Time Window</th>
                  <th className="p-4 text-right pr-6">Cause</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50 dark:divide-slate-800/50">
                {monitor.incidents?.length ? monitor.incidents.map((inc) => (
                  <tr key={inc.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 pl-6">
                      {!inc.resolvedAt ? (
                        <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full text-[10px] uppercase">Active</span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full text-[10px] uppercase">Fixed</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-slate-800 dark:text-slate-200">{new Date(inc.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Duration: {inc.durationSecs ? `${Math.floor(inc.durationSecs / 60)}m ${inc.durationSecs % 60}s` : 'Ongoing'}
                      </div>
                    </td>
                    <td className="p-4 text-right pr-6 max-w-[150px] truncate text-slate-500 italic" title={inc.cause || ''}>
                      {inc.cause || 'No Data'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-400 italic">No incidents recorded for this endpoint yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Activity Log */}
        <div className="glass rounded-2xl overflow-hidden self-start">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <h3 className="font-black text-sm tracking-widest flex items-center gap-2 uppercase">
              <History className="w-4 h-4 text-primary-500" /> Activity Log
            </h3>
            <span className="text-[10px] font-black text-slate-400 tracking-tighter">RECENT PINGS</span>
          </div>
          <ul className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {monitor.logs?.length ? monitor.logs.map((log) => (
              <li key={log.id} className="p-4 sm:px-6 flex items-center justify-between group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-4">
                  {log.status === 'UP' ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                      <XCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-black flex items-center gap-2">
                       {log.statusCode || 'Timeout'} 
                       <span className={cn(
                         "text-[10px] uppercase font-black px-1 rounded",
                         log.status === 'UP' ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
                       )}>{log.status}</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-200">
                  {log.responseTime ? `${log.responseTime}ms` : '—'}
                </div>
              </li>
            )) : (
              <li className="p-12 text-center text-slate-400 italic">No activity logged yet.</li>
            )}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default MonitorDetails;
