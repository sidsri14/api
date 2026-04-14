import { useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, IndianRupee, AlertTriangle, Download } from 'lucide-react';
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

// ── Skeletons
const SkeletonCard = () => (
  <div className="animate-pulse rounded-xl p-5 border border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800">
    <div className="h-2 bg-stone-100 dark:bg-stone-700 rounded w-20 mb-3" />
    <div className="h-6 bg-stone-200 dark:bg-stone-600 rounded w-16" />
  </div>
);
const SkeletonRow = () => (
  <div className="p-5 sm:px-8 flex items-center justify-between animate-pulse border-b border-stone-50 dark:border-white/5">
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-stone-100 dark:bg-white/5 rounded w-48" />
      <div className="h-1.5 bg-stone-50 dark:bg-white/5 rounded w-32" />
    </div>
    <div className="h-4 w-4 rounded bg-stone-100 dark:bg-white/10" />
  </div>
);

const Dashboard: FC<{ user: AuthUser }> = ({ user }) => {
  const navigate = useNavigate();
  const { state, setters, data, mutations } = useDashboardData(user);
  const queryClient = useQueryClient();

  // Re-fetch everything when the window gains focus or component mounts to ensure sync.
  useEffect(() => {
    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    };
    
    handleFocus(); // Initial mount refresh
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [queryClient]);

  const { search, statusFilter, sourceFilter, sortKey, sortDir, showUpgradeModal, lastFetchedAt, page } = state;
  const { setSearch, setStatusFilter, setSourceFilter, setSortKey, setSortDir, setShowUpgradeModal, setPage } = setters;
  const { plan, isPaid, stats, statsFetching, sources, paymentsPage, payments, isLoading, isFetching } = data;
  const { upgradeMutation, retryMutation, simulateFailureMutation } = mutations;

  const totalPages = paymentsPage?.pages ?? 1;

  // Derived logic
  const lostAmount = (stats?.totalFailedAmount ?? 0) - (stats?.totalRecoveredAmount ?? 0);
  const hasUnrecovered = lostAmount > 0;
  const hasSources = sources.length > 0;
  const hasFailure = payments.length > 0;
  const hasRecovery = useMemo(() => payments.some((p: { status: string }) => p.status === 'recovered'), [payments]);
  const onboardingComplete = hasSources && hasFailure && hasRecovery;

  const toggleSort = (key: 'status' | 'amount' | 'createdAt' | 'retryCount') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (isLoading && payments.length === 0) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="glass rounded-2xl overflow-hidden">
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
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

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        
        {/* ── Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">
                Recovery Dashboard
              </h1>
              <PlanBadge plan={plan} />
            </div>
            <p className="text-stone-400 text-xs font-medium tracking-wide">
              Automatic failed payment recovery
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(isFetching || statsFetching) && (
              <RefreshCw className="w-4 h-4 text-stone-400 animate-spin" />
            )}
            <MonitoringBadge lastFetchedAt={lastFetchedAt} isFetching={isFetching || statsFetching} />
          </div>
        </div>

        {/* ── Onboarding */}
        {!onboardingComplete && (
          <OnboardingChecklist
            hasSources={hasSources}
            hasFailure={hasFailure}
            hasRecovery={hasRecovery}
            plan={plan}
            onOpenSources={() => navigate('/sources')}
            onSimulate={() => simulateFailureMutation.mutate()}
            onUpgrade={() => setShowUpgradeModal(true)}
            simulating={simulateFailureMutation.isPending}
          />
        )}

        {/* ── Hard Paywall */}
        <AnimatePresence>
          {!isPaid && hasUnrecovered && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-5"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-red-700 dark:text-red-400">
                      You are losing {formatAmount(lostAmount)} right now.
                    </p>
                    <p className="text-xs text-red-600/70 dark:text-red-500/70 mt-0.5">
                      PayRecover recovers money automatically on the Pro plan.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all"
                >
                  Upgrade to Recover
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DashboardStats stats={stats} />

        {/* ── Filters */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="relative w-full lg:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by customer, email or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search payments"
              className="w-full pl-11 pr-5 py-3 rounded-2xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            {isPaid && (
              <button
                onClick={() => window.open(`${api.defaults.baseURL}/payments/export`, '_blank')}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl" role="tablist" aria-label="Filter by status">
              {['ALL', 'PENDING', 'RETRYING', 'RECOVERED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  role="tab"
                  aria-selected={statusFilter === s}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    statusFilter === s
                      ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm'
                      : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl items-center">
              <span className="text-[10px] uppercase font-semibold text-stone-400 px-2 italic">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none pr-4 text-stone-800 dark:text-stone-100"
              >
                <option value="ALL">All Sources</option>
                {sources.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name || s.type}</option>
                ))}
              </select>
            </div>

            <div className="border border-warm-border dark:border-stone-700 p-1 rounded-xl flex items-center gap-1.5 px-3 bg-white dark:bg-stone-800" role="group" aria-label="Sort by">
              <span className="text-[10px] uppercase font-semibold text-stone-300 mr-1">Sort:</span>
              {(['status', 'amount', 'createdAt', 'retryCount'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  aria-pressed={sortKey === key}
                  className={cn(
                    'text-[10px] font-semibold tracking-wider uppercase px-2 py-1.5 rounded-lg transition-all',
                    sortKey === key
                      ? 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200'
                      : 'text-stone-300 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  {key === 'createdAt' ? 'Date' : key === 'retryCount' ? 'Retries' : key}
                  {sortKey === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main List */}
        <div className="glass rounded-2xl overflow-hidden shadow-2xl">
          {payments.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <IndianRupee className="w-12 h-12 text-emerald-500 mx-auto opacity-20" />
              <h3 className="text-xl font-black text-stone-300 uppercase">No Payments Found</h3>
            </div>
          ) : (
            <ul className="divide-y divide-indigo-500/5 dark:divide-white/5" aria-label="Failed payment list">
              <AnimatePresence mode="popLayout">
                {payments.map((payment: { 
                  id: string; 
                  status: string; 
                  customerName?: string; 
                  customerEmail: string; 
                  amount: number; 
                  currency: string; 
                  retryCount: number; 
                  createdAt: string 
                }) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    isPaid={isPaid}
                    onRetry={(id) => retryMutation.mutate(id)}
                    onUpgrade={() => setShowUpgradeModal(true)}
                    onView={(id) => navigate(`/payments/${id}`)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}

          {/* ── Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 dark:border-white/5">
              <span className="text-xs text-stone-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40"
                >
                  Next
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
