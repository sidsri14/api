import React from 'react';
import { Shield, CheckCircle, AlertCircle, Clock, Server, Globe, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Monitor {
  id: string;
  name?: string;
  url: string;
  status: string;
  lastCheckedAt?: string;
}

const PublicStatus: React.FC = () => {
  const { data: monitorsResponse, isLoading, isError } = useQuery({
    queryKey: ['public-status'],
    queryFn: async () => {
      const { data } = await api.get('/public/status');
      return data.data as Monitor[];
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const monitors = monitorsResponse || [];
  const healthyCount = monitors.filter(m => m.status === 'UP').length;
  const allSystemOperational = healthyCount === monitors.length && monitors.length > 0;

  if (isLoading && !monitors.length) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <Server className="w-12 h-12 text-primary-500 animate-pulse" />
        <p className="text-sm font-black tracking-widest text-slate-400 uppercase">Synchronizing Status...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black">Connection Interrupted</h1>
          <p className="text-slate-500 max-w-xs mx-auto font-medium text-sm">We're having trouble reaching the status server. Please try again in a few moments.</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 lg:p-20 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-12"
      >
        {/* ── Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-600 rounded-2xl shadow-lg shadow-primary-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                Status <span className="text-primary-600 dark:text-primary-400">Hub</span>
              </h1>
              <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Live Infrastructure Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full uppercase">
            <Globe className="w-3.5 h-3.5 text-emerald-500" /> Global Real-time Sync
          </div>
        </div>

        {/* ── Summary Card */}
        <motion.div 
          layout
          className={cn(
            "glass-card border-l-8 p-8 flex flex-col md:flex-row items-center gap-8",
            allSystemOperational ? "border-l-emerald-500" : "border-l-amber-500"
          )}
        >
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center shrink-0",
            allSystemOperational ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
          )}>
            {allSystemOperational ? (
              <CheckCircle className="w-12 h-12" />
            ) : (
              <AlertCircle className="w-12 h-12" />
            )}
          </div>
          <div className="text-center md:text-left space-y-2">
            <h2 className="text-3xl font-black tracking-tight">
              {allSystemOperational ? 'All Systems Operational' : 'Identified Service Disruptions'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed max-w-xl">
              {allSystemOperational 
                ? 'Absolute clear. Every node in our network is performing within optimal parameters. Our engineers are constantly observing for any deviations.' 
                : 'Warning: We have detected anomalies in some of our service endpoints. Our automated response systems are handling mitigation.'}
            </p>
          </div>
        </motion.div>

        {/* ── Detailed Service Status */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-500" /> Infrastructure Node Detail
            </h3>
            <span className="text-[10px] font-bold text-slate-400 italic">UPDATED EVERY 30S</span>
          </div>

          <div className="glass rounded-3xl overflow-hidden shadow-2xl border border-white/10 dark:border-slate-800/50">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/10">
              <AnimatePresence mode="popLayout">
                {monitors.map((monitor, idx) => (
                  <motion.li 
                    key={monitor.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.05 } }}
                    className="p-6 md:px-10 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        {monitor.name || new URL(monitor.url).hostname}
                      </span>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Checked {monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all duration-500 shadow-sm",
                        monitor.status === 'UP' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse shadow-red-500/5'
                      )}>
                        {monitor.status}
                      </span>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </div>

        {/* ── Footer */}
        <div className="pt-12 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Powered by</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-2xl grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
            <Shield className="w-5 h-5 text-primary-600" />
            <span className="text-sm font-black tracking-tighter">ANTIGRAVITY <span className="text-primary-600">MONITORING</span></span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PublicStatus;
