import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Loader2, Activity, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, API_URL } from '../api';
import toast from 'react-hot-toast';

interface AuditLog {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: string | null;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  'LOGIN_SUCCESS': 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
  'LOGIN_FAILED': 'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
  'PASSWORD_RESET_REQUESTED': 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  'API_KEY_CREATED': 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
  'WEBHOOK_CREATED': 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  'PII_PRUNED': 'text-stone-500 bg-stone-100 dark:bg-stone-800',
};

const Security: FC = () => {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: async () => {
      const { data } = await api.get(`/security/audit-logs?page=${page}&limit=${limit}`);
      return data.data;
    },
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load security logs');
  }, [isError]);

  const logs: AuditLog[] = data?.logs || [];
  const totalPages = data?.pages || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-10 pb-20"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl">
            <Shield className="w-6 h-6 text-stone-700 dark:text-stone-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">
              Security & Audit
            </h1>
            <p className="text-stone-400 mt-1 font-medium text-xs tracking-wide">
              Review account activity, log-ins, and data access.
            </p>
          </div>
        </div>
        <button
          onClick={() => window.open(`${API_URL}/security/audit-logs/export`, '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-stone-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-stone-700 dark:hover:bg-stone-600 transition-all"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </header>

      <div className="bg-white dark:bg-stone-900 border border-warm-border dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-warm-border dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/30">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-stone-400" />
            <h2 className="text-sm font-bold text-stone-700 dark:text-stone-200 uppercase tracking-widest">Activity Log</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="w-8 h-8 text-stone-300 dark:text-stone-600 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-20 text-center">
            <Shield className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto opacity-50 mb-4" />
            <h3 className="text-lg font-black text-stone-400 uppercase tracking-wider">No Activity Logged</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 dark:bg-stone-800/50 border-b border-warm-border dark:border-stone-800">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Event Action</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Resource</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border dark:divide-stone-800">
                <AnimatePresence>
                  {logs.map((log, idx) => (
                    <motion.tr 
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                      className="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-stone-500 dark:text-stone-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-current ${actionColors[log.action] || 'text-stone-600 bg-stone-100 dark:text-stone-400 dark:bg-stone-800'}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-stone-600 dark:text-stone-300 font-medium">
                        {log.resource || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-stone-500 dark:text-stone-400 max-w-xs truncate" title={log.details || ''}>
                        {log.details ? String(log.details) : '-'}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-warm-border dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-widest">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-warm-border dark:border-stone-700 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors shadow-sm"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-warm-border dark:border-stone-700 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Security;
