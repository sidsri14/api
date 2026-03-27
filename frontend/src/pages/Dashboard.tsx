import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle, Activity, ServerCrash, Clock, Trash2, AlertCircle,
  Search, ArrowUpDown, TrendingUp, TrendingDown, Minus, Shield, RefreshCw
} from 'lucide-react';
import { api } from '../api';
import CreateMonitorModal from '../components/CreateMonitorModal';
import toast from 'react-hot-toast';

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

// ── Skeleton card
const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse">
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-4" />
    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-12" />
  </div>
);

// ── Skeleton monitor row
const SkeletonRow: React.FC = () => (
  <li className="p-4 sm:px-6 flex items-center justify-between animate-pulse">
    <div className="flex-1 space-y-2">
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-56" />
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-10" />
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-36 ml-6" />
    </div>
    <div className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700" />
  </li>
);

// ── Trend badge
const TrendBadge: React.FC<{ trend?: 'up' | 'down' | 'stable'; value?: number }> = ({ trend, value }) => {
  if (!trend || !value) return null;
  if (trend === 'up') return (
    <span className="flex items-center text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3 mr-1" />{value}ms
    </span>
  );
  if (trend === 'down') return (
    <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
      <TrendingDown className="w-3 h-3 mr-1" />{value}ms
    </span>
  );
  return (
    <span className="flex items-center text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3 mr-1" />{value}ms
    </span>
  );
};

// ── Status dot with pulse for DOWN
const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const base = 'w-3 h-3 rounded-full flex-shrink-0';
  if (status === 'UP') return <span className={`${base} bg-emerald-500`} />;
  if (status === 'DOWN') return (
    <span className="relative flex h-3 w-3 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className={`${base} bg-red-500 relative`} />
    </span>
  );
  return <span className={`${base} bg-amber-400`} />;
};

const Dashboard: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const fetchMonitors = async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      const { data } = await api.get('/monitors');
      if (data.success) {
        setMonitors(data.data);
        setError(null);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to fetch monitors';
      setError(msg);
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this monitor?')) return;

    // Optimistic remove + track deleting state
    setDeletingIds(prev => new Set([...prev, id]));
    const prev = [...monitors];
    setMonitors(m => m.filter(x => x.id !== id));

    try {
      await api.delete(`/monitors/${id}`);
      toast.success('Monitor deleted');
    } catch (err: any) {
      setMonitors(prev);
      const msg = err.response?.data?.error || 'Failed to delete monitor';
      toast.error(msg);
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

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
  }, [monitors, search, sortKey, sortDir]);

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

  // ── Initial skeleton load
  if (loading && monitors.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Overview of your API health</p>
          </div>
          <div className="w-36 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </ul>
        </div>
      </div>
    );
  }

  // ── Error state (no data at all)
  if (error && monitors.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Connection Error</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">{error}</p>
        <button
          onClick={() => fetchMonitors(true)}
          className="mt-6 bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-500 transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Overview of your API health</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" aria-label="Refreshing…" />
          )}
          {error && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
              Live update failed
            </span>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg font-medium flex items-center transition shadow-sm"
          >
            <PlusCircle className="w-5 h-5 mr-2" /> Add Monitor
          </button>
        </div>
      </div>

      {/* ── Active Incidents Alert */}
      {downCount > 0 && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl overflow-hidden">
            <div className="p-4 bg-red-100/50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/30 flex items-center justify-between">
              <div className="flex items-center text-red-700 dark:text-red-400 font-bold">
                <AlertCircle className="w-5 h-5 mr-2" />
                Active Incidents ({downCount})
              </div>
            </div>
            <div className="divide-y divide-red-100 dark:divide-red-900/20">
              {monitors.filter(m => m.status === 'DOWN').map(m => (
                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-red-100/30 dark:hover:bg-red-900/5 transition cursor-pointer" onClick={() => navigate(`/monitors/${m.id}`)}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-red-900 dark:text-red-300">{m.url}</span>
                    <span className="text-xs text-red-600 dark:text-red-500 mt-1 flex items-center">
                      <ServerCrash className="w-3 h-3 mr-1" /> Critical Failure Detected
                    </span>
                  </div>
                  <button className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline">View Details →</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Monitors</span>
          <div className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{monitors.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Avg Latency</span>
          <div className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{avgLatency}<span className="text-sm font-medium text-slate-400 ml-1">ms</span></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-red-100 dark:border-red-900/40 transition-colors">
          <span className="text-red-500 dark:text-red-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <ServerCrash className="w-3.5 h-3.5" /> Failing Now
          </span>
          <div className="text-3xl font-bold text-red-500 dark:text-red-400 mt-2">{downCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-primary-100 dark:border-primary-900/40 transition-colors">
          <span className="text-primary-600 dark:text-primary-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Uptime
          </span>
          <div className={`text-3xl font-bold mt-2 ${uptimePct >= 99 ? 'text-emerald-600 dark:text-emerald-500' : uptimePct >= 95 ? 'text-amber-500' : 'text-red-500'}`}>
            {monitors.length === 0 ? '—' : `${uptimePct}%`}
          </div>
        </div>
      </div>

      {/* ── Search + Sort toolbar */}
      {monitors.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by URL or method…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>
          
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
            {(['ALL', 'UP', 'DOWN'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  statusFilter === s 
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort:</span>
            {(['status', 'url', 'lastCheckedAt', 'avgResponseTime'] as SortKey[]).map(key => {
              const labels: Record<SortKey, string> = { status: 'Status', url: 'URL', lastCheckedAt: 'Last Check', avgResponseTime: 'Latency' };
              return (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={`px-3 py-1.5 rounded-full transition ${sortKey === key
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {labels[key]} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Monitor list */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        {monitors.length === 0 ? (
          // Empty state
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Activity className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No monitors yet</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto mb-6">
              Add your first API endpoint to start tracking uptime and response times.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg font-medium inline-flex items-center gap-2 transition shadow-sm"
            >
              <PlusCircle className="w-4 h-4" /> Add your first monitor
            </button>
          </div>
        ) : filtered.length === 0 ? (
          // No search results
          <div className="p-12 text-center">
            <Search className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No monitors match <span className="font-bold text-slate-700 dark:text-slate-200">"{search}"</span></p>
            <button onClick={() => setSearch('')} className="mt-3 text-primary-500 text-sm hover:underline">Clear search</button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((monitor) => (
              <li
                key={monitor.id}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group ${deletingIds.has(monitor.id) ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div
                  onClick={() => navigate(`/monitors/${monitor.id}`)}
                  className="p-4 sm:px-6 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-1.5">
                      <StatusDot status={monitor.status} />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{monitor.name || monitor.url}</p>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex-shrink-0">
                        {monitor.method}
                      </span>
                      {monitor.status === 'DOWN' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex-shrink-0">
                          DOWN
                        </span>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap text-xs text-slate-500 dark:text-slate-400 space-x-4 ml-6">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" /> {monitor.interval}s
                      </span>
                      <span>
                        Last: {monitor.lastCheckedAt
                          ? new Date(monitor.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : <span className="text-amber-500 font-medium">Pending first check…</span>}
                      </span>
                      {monitor.avgResponseTime !== undefined && (
                        <TrendBadge trend={monitor.responseTimeTrend} value={monitor.avgResponseTime} />
                      )}
                      {monitor.uptime30d !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${monitor.uptime30d >= 99 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
                          {monitor.uptime30d}% uptime
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(monitor.id); }}
                    className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition opacity-0 group-hover:opacity-100 cursor-pointer p-2 z-10 ml-2"
                    title="Delete Monitor"
                  >
                    <Trash2 className="w-5 h-5 pointer-events-none" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Count bar */}
      {filtered.length > 0 && filtered.length !== monitors.length && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-right">
          Showing {filtered.length} of {monitors.length} monitors
        </p>
      )}

      <CreateMonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { setIsModalOpen(false); fetchMonitors(); }}
      />
    </div>
  );
};

export default Dashboard;
