import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle, Activity, Clock, Trash2,
  Search, RefreshCw, 
  Settings2, PauseCircle,
  TrendingUp, TrendingDown, Minus, ServerCrash, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import CreateMonitorModal from '../components/CreateMonitorModal';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Monitor {
  id: string;
  name: string;
  projectId: string;
  url: string;
  method: string;
  interval: number;
  status: string;
  lastCheckedAt?: string;
  avgResponseTime?: number;
  responseTimeTrend?: 'up' | 'down' | 'stable';
  uptime30d?: number;
}

type SortKey = 'status' | 'url' | 'lastCheckedAt' | 'avgResponseTime';
type SortDir = 'asc' | 'desc';

// ── Skeleton Loader (Clean White)
const SkeletonCard = () => (
  <div className="glass-card animate-pulse shadow-sm !p-6 !rounded-2xl border border-blue-50 dark:border-white/5">
    <div className="h-2 bg-blue-500/5 dark:bg-white/5 rounded w-20 mb-3" />
    <div className="h-6 bg-blue-500/10 dark:bg-white/10 rounded w-10" />
  </div>
);

const SkeletonRow = () => (
  <div className="p-5 sm:px-8 flex items-center justify-between animate-pulse border-b border-blue-50/50 dark:border-white/5">
    <div className="flex-1 space-y-2">
      <div className="flex items-center space-x-4">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500/10 dark:bg-white/10" />
        <div className="h-3 bg-blue-500/5 dark:bg-white/5 rounded w-48" />
      </div>
      <div className="h-1.5 bg-blue-500/5 dark:bg-white/5 rounded w-32 ml-7" />
    </div>
    <div className="h-4 w-4 rounded bg-blue-500/10 dark:bg-white/10" />
  </div>
);

// ── Component: TrendBadge
const TrendBadge: React.FC<{ trend?: 'up' | 'down' | 'stable'; value?: number }> = ({ trend, value }) => {
  if (!trend || value === undefined) return null;
  const colors = {
    up: "text-emerald-500 bg-emerald-500/5",
    down: "text-red-500 bg-red-500/5",
    stable: "text-blue-400 bg-blue-500/5"
  };
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <span className={cn("flex items-center text-xs font-semibold px-2 py-0.5 rounded-full transition-colors", colors[trend])}>
      <Icon className="w-3 h-3 mr-1" />{value}ms
    </span>
  );
};

// ── Component: StatusDot
const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'UP') return <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />;
  if (status === 'DOWN') return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
    </span>
  );
  return <span className="w-3 h-3 rounded-full bg-amber-400" />;
};

const Dashboard: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Data Fetching with React Query
  const { data: monitorsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['monitors'],
    queryFn: async () => {
      const { data } = await api.get('/monitors');
      return data.data as Monitor[];
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const monitors = monitorsResponse || [];

  // ── Mutation: Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/monitors/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['monitors'] });
      const previousMonitors = queryClient.getQueryData(['monitors']);
      queryClient.setQueryData(['monitors'], (old: Monitor[] | undefined) => 
        old?.filter(m => m.id !== id)
      );
      return { previousMonitors };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['monitors'], context?.previousMonitors);
      toast.error('Failed to delete monitor');
    },
    onSuccess: () => {
      toast.success('Monitor deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
    }
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return monitors
      .filter(m => {
        const matchesSearch = (m.name || m.url).toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'status') {
          const order: Record<string, number> = { DOWN: 0, PENDING: 1, UP: 2 };
          cmp = (order[a.status] ?? 3) - (order[b.status] ?? 3);
        } else if (sortKey === 'url') {
          cmp = a.url.localeCompare(b.url);
        } else if (sortKey === 'lastCheckedAt') {
          cmp = (new Date(a.lastCheckedAt || 0).getTime()) - (new Date(b.lastCheckedAt || 0).getTime());
        } else if (sortKey === 'avgResponseTime') {
          cmp = (a.avgResponseTime ?? Infinity) - (b.avgResponseTime ?? Infinity);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [monitors, search, statusFilter, sortKey, sortDir]);

  const downCount = monitors.filter(m => m.status === 'DOWN').length;
  const upCount = monitors.filter(m => m.status === 'UP').length;
  const avgLatency = monitors.length > 0 
    ? Math.round(monitors.reduce((acc, m) => acc + (m.avgResponseTime || 0), 0) / monitors.length) 
    : 0;
  const uptimePct = monitors.length > 0 
    ? parseFloat(((upCount / monitors.length) * 100).toFixed(1)) 
    : 100;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (isLoading && monitors.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-2" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="glass rounded-2xl overflow-hidden border border-blue-100 dark:border-white/5">
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* ── Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">
            Dashboard
          </h1>
          <p className="text-stone-400 mt-1 font-medium text-xs tracking-wide">
            Infrastructure Monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isFetching && (
            <RefreshCw className="w-5 h-5 text-stone-400 animate-spin" />
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            <PlusCircle className="w-5 h-5" /> Add Monitor
          </button>
        </div>
      </div>

      {/* ── Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -1 }} className="border border-warm-border dark:border-stone-700 rounded-xl p-6 bg-white dark:bg-stone-800 shadow-soft">
          <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Targets</p>
          <div className="text-3xl font-bold text-stone-800 dark:text-stone-100">{monitors.length}</div>
        </motion.div>
        
        <motion.div whileHover={{ y: -1 }} className="border border-warm-border dark:border-stone-700 rounded-xl p-6 bg-white dark:bg-stone-800 shadow-soft">
          <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Avg Latency</p>
          <div className="text-3xl font-bold text-stone-800 dark:text-stone-100">
            {avgLatency}<span className="text-sm text-stone-300 ml-1 font-medium">ms</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -1 }} className={cn("border border-warm-border dark:border-stone-700 rounded-xl p-6 bg-white dark:bg-stone-800 shadow-soft border-l-4", downCount > 0 ? "border-l-red-400" : "border-l-transparent")}>
          <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2">
            <ServerCrash className={cn("w-3 h-3 transition-colors", downCount > 0 ? "text-red-400 animate-pulse" : "text-stone-300")} /> Issues
          </p>
          <div className={cn("text-3xl font-bold transition-colors", downCount > 0 ? "text-red-500" : "text-stone-800 dark:text-stone-100")}>
            {downCount}
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -1 }} className="border border-warm-border dark:border-stone-700 rounded-xl p-6 bg-white dark:bg-stone-800 shadow-soft">
          <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2">
            <Shield className="w-3 h-3 text-stone-400" /> Uptime
          </p>
          <div className={cn("text-3xl font-bold transition-colors", 
            uptimePct >= 99 ? "text-emerald-600 dark:text-emerald-400" : uptimePct >= 95 ? "text-amber-500" : "text-red-500"
          )}>
            {uptimePct}<span className="text-sm opacity-30 ml-0.5">%</span>
          </div>
        </motion.div>
      </div>

      {/* ── Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-stone-600 transition-colors" />
          <input
            type="text"
            placeholder="Search endpoint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-warm-border dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-sm font-medium focus:border-stone-400 dark:focus:border-stone-500 outline-none transition-all placeholder:text-stone-300 text-stone-700 dark:text-stone-200"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 p-1 rounded-xl flex items-center">
            {(['ALL', 'UP', 'DOWN'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-5 py-2 rounded-lg text-xs font-semibold transition-all",
                  statusFilter === s 
                    ? "bg-stone-700 dark:bg-stone-600 text-white shadow-sm" 
                    : "text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="border border-warm-border dark:border-stone-700 p-1 rounded-xl flex items-center gap-1.5 px-3 bg-white dark:bg-stone-800">
            <span className="text-[10px] uppercase font-semibold text-stone-300 mr-1">Sort:</span>
            {(['status', 'url', 'avgResponseTime'] as SortKey[]).map(key => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={cn(
                  "text-[10px] font-semibold tracking-wider uppercase px-2 py-1.5 rounded-lg transition-all",
                  sortKey === key 
                    ? "bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200" 
                    : "text-stone-300 hover:text-stone-600 dark:hover:text-stone-300"
                )}
              >
                {key.replace('avg', '')} {sortKey === key && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monitor List */}
      <div className="glass rounded-2xl overflow-hidden shadow-2xl">
        {filtered.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-stone-100 dark:bg-stone-700 rounded-full flex items-center justify-center mx-auto">
              <Activity className="w-10 h-10 text-indigo-500 animate-pulse" />
            </div>
            <h3 className="text-2xl font-black custom-gradient-text uppercase">Securely Quiet.</h3>
            <p className="text-blue-400 dark:text-blue-500/60 max-w-xs mx-auto text-sm font-bold uppercase tracking-widest mt-2">
              Add a monitor to begin.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-indigo-500/5 dark:divide-white/5">
            <AnimatePresence mode="popLayout">
              {filtered.map((monitor) => (
                <motion.li
                  key={monitor.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-300"
                >
                  <div className="flex items-center p-5 sm:px-8 gap-6">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/monitors/${monitor.id}`)}>
                      <div className="flex items-center gap-3 mb-1.5">
                        <StatusDot status={monitor.status} />
                        <h4 className="text-base font-bold truncate group-hover:underline text-black dark:text-white transition-all">
                          {monitor.name || monitor.url}
                        </h4>
                        <span className="text-[9px] font-black bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md uppercase text-zinc-400 border border-zinc-100 dark:border-zinc-800">
                          {monitor.method}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-blue-400 dark:text-blue-500/60 ml-6 uppercase tracking-tighter">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> {monitor.interval}s 
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" /> 
                          {monitor.lastCheckedAt 
                            ? new Date(monitor.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                            : 'Never checked'}
                        </span>
                        <TrendBadge trend={monitor.responseTimeTrend} value={monitor.avgResponseTime} />
                        {monitor.uptime30d !== undefined && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter",
                            monitor.uptime30d >= 99 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                          )}>
                            {monitor.uptime30d}% 30D
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button 
                        className="p-2 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                        title="Quick Edit"
                      >
                        <Settings2 className="w-5 h-5" />
                      </button>
                      <button 
                        className="p-2 text-zinc-400 hover:text-amber-500 rounded-lg hover:bg-amber-500/10 transition-all"
                        title="Pause Monitoring"
                      >
                        <PauseCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if(confirm('Permanently delete?')) deleteMutation.mutate(monitor.id); }}
                        className="p-2 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-500/10 transition-all"
                        disabled={deleteMutation.isPending}
                        title="Delete Forever"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <CreateMonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { setIsModalOpen(false); queryClient.invalidateQueries({ queryKey: ['monitors'] }); }}
      />
    </motion.div>
  );
};

export default Dashboard;
