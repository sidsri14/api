import React, { useEffect, useState } from 'react';
import { Shield, Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api';

interface Monitor {
  id: string;
  name?: string;
  url: string;
  status: string;
  lastCheckedAt?: string;
}

const PublicStatus: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        // In a real app, this would be a public endpoint /api/public/status
        // For MVP, we'll try to reuse /api/monitors but it might require auth.
        // Assume for now it's a dedicated public route we'll add to the backend.
        const { data } = await api.get('/public/status'); 
        if (data.success) setMonitors(data.data);
      } catch (err) {
        console.error('Failed to fetch public status', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicData();
    const interval = setInterval(fetchPublicData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Activity className="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  );

  const healthyCount = monitors.filter(m => m.status === 'UP').length;
  const allSystemOperational = healthyCount === monitors.length && monitors.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Status Center</h1>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Auto-refreshing every 30s
          </div>
        </div>

        <div className={`mb-8 p-6 rounded-2xl border flex items-center gap-4 ${
          allSystemOperational 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-amber-50 border-amber-100 text-amber-800'
        }`}>
          {allSystemOperational ? (
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          ) : (
            <AlertCircle className="w-8 h-8 text-amber-500" />
          )}
          <div>
            <h2 className="text-lg font-bold">
              {allSystemOperational ? 'All Systems Operational' : 'Partial System Outage'}
            </h2>
            <p className="text-sm opacity-80">
              {allSystemOperational 
                ? 'We are currently monitoring all services and everything is running smoothly.' 
                : 'We have detected some service interruptions. Our team is investigating.'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Current Service Status
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {monitors.map(monitor => (
              <li key={monitor.id} className="p-5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 dark:text-white">{monitor.name || new URL(monitor.url).hostname}</span>
                  <span className="text-xs text-slate-500 mt-1 flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> Last check: {monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleTimeString() : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    monitor.status === 'UP' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {monitor.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-12 text-center text-slate-400 text-xs">
          Powered by AntiGravity Monitoring
        </p>
      </div>
    </div>
  );
};

export default PublicStatus;
