import { useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Search, RefreshCw, AlertTriangle, Download, CheckCircle2, Plus, Filter, Sparkles } from 'lucide-react';
import { api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { formatAmount } from '../utils/format';
import type { AuthUser } from '../App';

// ── Sub-components
import { PlanBadge } from '../components/dashboard/Badges';
import { MonitoringBadge } from '../components/dashboard/MonitoringBadge';
import { UpgradeModal } from '../components/dashboard/UpgradeModal';
import { OnboardingChecklist } from '../components/dashboard/OnboardingChecklist';
import { DashboardStats } from '../components/dashboard/DashboardStats';
import { PaymentRow } from '../components/dashboard/PaymentRow';
import { useDashboardData } from '../components/dashboard/useDashboardData';

// ── Worker Status Badge
const WorkerStatusBadge: FC = () => {
  const { data } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const { data } = await api.get('/queue/stats');
      return data.data as { worker: { status: string; lastSeenMs: number | null } };
    },
    refetchInterval: 60_000,
    retry: false,
  });

  const status = data?.worker?.status ?? 'unknown';
  const cfg: Record<string, { label: string; dot: string; text: string }> = {
    online:  { label: 'Core Online',  dot: 'bg-emerald-500 shadow-lg shadow-emerald-500/20 animate-pulse', text: 'text-emerald-600 dark:text-emerald-400' },
    stale:   { label: 'Core Stale',   dot: 'bg-amber-400 shadow-lg shadow-amber-400/20',                  text: 'text-amber-600 dark:text-amber-400' },
    offline: { label: 'Core Offline', dot: 'bg-rose-500 shadow-lg shadow-rose-500/20',                   text: 'text-rose-600 dark:text-rose-400' },
    unknown: { label: 'Core Neutral', dot: 'bg-slate-400',                   text: 'text-slate-400' },
  };
  const { label, dot, text } = cfg[status] ?? cfg.unknown;

  return (
    <span className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] ${text} bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
};

// ── Skeletons
const SkeletonCard = () => (
  <div className="glass-card !p-6 animate-pulse border-slate-100 dark:border-slate-800">
    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-24 mb-6" />
    <div className="h-8 bg-slate-200 dark:bg-slate-700/50 rounded w-32 mb-4" />
    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-20" />
  </div>
);

const Dashboard: FC<{ user: AuthUser }> = ({ user }) => {
  const navigate = useNavigate();
  const { state, setters, data, mutations } = useDashboardData(user);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    };
    
    handleFocus(); 
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [queryClient]);

  const { search, statusFilter, sourceFilter, sortKey, sortDir, showUpgradeModal, lastFetchedAt, page } = state;
  const { setSearch, setStatusFilter, setSourceFilter, setSortKey, setSortDir, setShowUpgradeModal, setPage } = setters;
  const { plan, isPaid, stats, statsFetching, sources, paymentsPage, payments, isLoading, isFetching } = data;
  const { upgradeMutation, sendReminderMutation } = mutations;

  const totalPages = paymentsPage?.pages ?? 1;

  const onboardingComplete = useMemo(() => {
    const hasClients = sources.length > 0;
    const hasInvoices = payments.length > 0;
    const hasPaid = payments.some((p: { status: string }) => p.status === 'PAID');
    return hasClients && hasInvoices && hasPaid;
  }, [sources, payments]);

  if (isLoading && payments.length === 0) {
    return (
      <div className="space-y-10 py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="glass-card !p-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
             <div key={i} className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between animate-pulse">
                <div className="space-y-3">
                   <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-64" />
                   <div className="h-2 bg-slate-50 dark:bg-slate-800/50 rounded w-40" />
                </div>
                <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800" />
             </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showUpgradeModal && (
          <UpgradeModal
            onClose={() => setShowUpgradeModal(false)}
            onUpgrade={(gateway) => upgradeMutation.mutate(gateway)}
            upgrading={upgradeMutation.isPending}
          />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-12 py-10">
        
        {/* ── Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
               <motion.span 
                 whileHover={{ rotate: 10 }}
                 className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20"
               >
                 <Sparkles className="w-6 h-6 text-white" />
               </motion.span>
               <div>
                  <h1 className="text-4xl font-black gradient-heading tracking-tighter">Engine Central</h1>
                  <div className="flex items-center gap-2">
                    <PlanBadge plan={plan} />
                    <WorkerStatusBadge />
                  </div>
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/invoices/new')}
              className="btn-primary !py-4 group flex-1 lg:flex-none justify-center"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Create Invoice
            </motion.button>
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <MonitoringBadge lastFetchedAt={lastFetchedAt} isFetching={isFetching || statsFetching} />
                {(isFetching || statsFetching) && (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                )}
            </div>
          </div>
        </div>

        {/* ── Onboarding */}
        {!onboardingComplete && (
          <OnboardingChecklist
            hasSources={sources.length > 0}
            hasFailure={payments.length > 0}
            hasRecovery={payments.some(p => p.status === 'PAID')}
            plan={plan}
            onOpenSources={() => navigate('/clients')}
            onSimulate={() => navigate('/invoices/new')}
            onUpgrade={() => setShowUpgradeModal(true)}
            simulating={false}
          />
        )}

        <DashboardStats stats={stats} />

        {/* ── Filters & Search */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
          <div className="relative w-full xl:w-[500px] group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-all" />
            <input
              type="text"
              placeholder="Deep search client, invoice ID, or amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 text-base font-bold transition-all shadow-sm group-hover:shadow-md"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-inner">
              {['ALL', 'PENDING', 'PAID', 'OVERDUE'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300',
                    statusFilter === s
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xl scale-105'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-5 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-[0.2em] outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="ALL">All Clients</option>
                {sources.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Main List Container */}
        <div className="glass-card !p-0 hover:scale-100 shadow-premium glow-sapphire overflow-hidden">
          {payments.length === 0 ? (
            <div className="py-40 text-center space-y-6">
              <div className="relative inline-block">
                 <CheckCircle2 className="w-20 h-20 text-emerald-500/10 mx-auto" />
                 <motion.div 
                   animate={{ rotate: 360 }}
                   transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                   className="absolute inset-0 border-2 border-dashed border-emerald-500/20 rounded-full"
                 />
              </div>
              <div className="space-y-1">
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Silence is Golden</h3>
                 <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-400/80 mb-0.5">StripeFlow Core</p>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No matching records found in this sequence</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Identity / Invoice</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Revenue Impact</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Status Hub</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  <AnimatePresence mode="popLayout">
                    {payments.map((invoice: any) => (
                      <PaymentRow
                        key={invoice.id}
                        payment={{
                          ...invoice,
                          customerName: invoice.client?.name,
                          customerEmail: invoice.clientEmail
                        }}
                        isPaid={isPaid}
                        onRetry={(id) => sendReminderMutation.mutate(id)}
                        onUpgrade={() => setShowUpgradeModal(true)}
                        onView={(id) => navigate(`/invoices/${id}`)}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-10 py-8 bg-slate-50/30 dark:bg-white/[0.02] border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Manifest {page} &middot; {totalPages}
              </span>
              <div className="flex gap-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-6 py-2 text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                >
                  Retract
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl hover:scale-105 disabled:opacity-30 transition-all font-black"
                >
                  Advance
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default Dashboard;
