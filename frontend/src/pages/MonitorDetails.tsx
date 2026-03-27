import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import toast from 'react-hot-toast';

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
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitor = useCallback(async () => {
    try {
      const { data } = await api.get(`/monitors/${id}`);
      if (data.success) {
        setMonitor(data.data);
        setError(null);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to fetch monitor details';
      setError(msg);
      if (err.response?.status === 401) {
        toast.error('Session expired');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMonitor();
    const interval = setInterval(fetchMonitor, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchMonitor]);

  if (loading && !monitor) {
    return (
      <div>
        <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-6 animate-pulse" />
        <div className="h-8 w-96 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-8 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-28 mb-4" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-8 animate-pulse">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-6" />
          <div className="h-72 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error && !monitor) {
    return (
      <div className="flex flex-col justify-center items-center h-72 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Failed to load details</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">{error}</p>
        <Link to="/" className="mt-6 bg-primary-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-primary-500 transition">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!monitor) return <div className="p-8 text-center text-red-500">Monitor not found</div>;

  const chartData = [...(monitor.logs || [])].reverse().map((log) => ({
    time: new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    responseTime: log.responseTime || 0,
    status: log.status
  }));

  const avgResponseTime = chartData.length > 0 
    ? Math.round(chartData.reduce((acc, log) => acc + log.responseTime, 0) / chartData.length)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-primary-600 dark:text-primary-500 hover:text-primary-800 dark:hover:text-primary-400 text-sm font-medium flex items-center mb-4 transition">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 text-2xl font-bold text-slate-900 dark:text-white mb-1">
               <span className={`w-4 h-4 rounded-full ${
                  monitor.status === 'UP' ? 'bg-emerald-500' : 
                  monitor.status === 'DOWN' ? 'bg-red-500' : 'bg-amber-400'
                }`}></span>
              <h1>{monitor.name || monitor.url}</h1>
            </div>
            <div className="flex space-x-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span className="text-slate-400 font-normal">{monitor.name ? monitor.url : ''}</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">{monitor.method}</span>
              <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> Checks every {monitor.interval}s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
         <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Current Status</div>
            <div className={`text-2xl font-bold ${monitor.status === 'UP' ? 'text-emerald-600 dark:text-emerald-500' : monitor.status === 'DOWN' ? 'text-red-500 dark:text-red-400' : 'text-amber-500'}`}>
              {monitor.status}
            </div>
         </div>
         <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Avg Response (Last 50)</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{avgResponseTime} <span className="text-sm font-medium text-slate-400">ms</span></div>
         </div>
         <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">30-Day Uptime</div>
            <div className={`text-2xl font-bold ${monitor.uptime30d !== undefined && monitor.uptime30d >= 99 ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
              {monitor.uptime30d !== undefined ? `${monitor.uptime30d}%` : '100%'}
            </div>
         </div>
         <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Checks Logged</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{monitor.logs?.length || 0}</div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8 transition-colors">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary-500" /> Response Time History
        </h3>
        <div className="h-72 w-full text-sm">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.3} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} unit="ms" />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-colors-slate-800, #1e293b)', color: '#fff' }}
                />
                <Line type="monotone" dataKey="responseTime" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">Not enough data to graph yet.</div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors mb-8">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-white">Incident History</h3>
          <span className="text-xs text-slate-500 font-medium">Last 20 events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Status</th>
                <th className="p-4">Started</th>
                <th className="p-4">Resolved</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Cause</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {monitor.incidents && monitor.incidents.length > 0 ? monitor.incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="p-4">
                    {!incident.resolvedAt ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase">Open</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">Resolved</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{new Date(incident.startedAt).toLocaleString()}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : '—'}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                    {incident.durationSecs ? `${Math.floor(incident.durationSecs / 60)}m ${incident.durationSecs % 60}s` : '—'}
                  </td>
                  <td className="p-4 text-slate-500 italic max-w-xs truncate" title={incident.cause || 'No cause logged'}>
                    {incident.cause || 'Unknown'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No major incidents recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-800 dark:text-white">Recent Logs</h3>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {monitor.logs?.map((log) => (
            <li key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
              <div className="flex items-center space-x-4">
                {log.status === 'UP' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{log.statusCode || 'N/A'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{log.responseTime ? `${log.responseTime}ms` : 'Timeout'}</div>
            </li>
          ))}
          {(!monitor.logs || monitor.logs.length === 0) && (
            <li className="p-8 text-center text-slate-400">No logs recorded yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default MonitorDetails;
