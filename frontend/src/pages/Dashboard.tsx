import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, TrendingUp, ExternalLink, RotateCcw, IndianRupee,
  Zap, CheckCircle2, Shield, Calendar, Lock, X,
  CheckCircle, Circle, ChevronRight, Sparkles, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RecoveryLink { id: string; url: string; createdAt: string; }
interface FailedPayment {
  id: string; paymentId: string; orderId?: string;
  amount: number; currency: string;
  customerEmail: string; customerPhone?: string; customerName?: string;
  status: 'pending' | 'retrying' | 'recovered' | 'abandoned';
  retryCount: number; lastRetryAt?: string; recoveredAt?: string;
  recoveredVia?: 'link' | 'external';
  recoveryLinks: RecoveryLink[];
  createdAt: string;
}
interface DashboardStats {
  totalFailed: number; totalRecovered: number; recoveryRate: number;
  totalFailedAmount: number; totalRecoveredAmount: number;
  recoveredThisWeek: number; recoveredThisMonth: number;
}
interface AuthUser { id: string; email: string; plan: 'free' | 'paid'; createdAt: string; }
interface PaymentSource { id: string; }

type SortKey = 'status' | 'amount' | 'createdAt' | 'retryCount';
type SortDir = 'asc' | 'desc';

const formatAmount = (paise: number, currency = 'INR') => {
  const symbol = currency === 'INR' ? '₹' : currency + ' ';
  return `${symbol}${(paise / 100).toLocaleString('en-IN')}`;
};
const daysSince = (d: string) =>
  Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));

// ── Skeleton
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

// ── Status Badge
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    pending:   'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    retrying:  'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
    recovered: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    abandoned: 'bg-stone-500/10 text-stone-500 border-stone-200 dark:border-stone-700',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border', styles[status] || styles.pending)}>
      {status}
    </span>
  );
};

// ── Plan Badge
const PlanBadge: React.FC<{ plan: 'free' | 'paid' }> = ({ plan }) => (
  <span className={cn(
    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
    plan === 'paid'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
      : 'bg-stone-50 text-stone-500 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
  )}>
    {plan === 'paid' ? <Sparkles className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
    {plan === 'paid' ? 'Pro' : 'Free'}
  </span>
);

// ── Monitoring Badge
const MonitoringBadge: React.FC<{ lastFetchedAt: Date | null; isFetching: boolean }> = ({ lastFetchedAt, isFetching }) => {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const minutesAgo = lastFetchedAt ? Math.floor((Date.now() - lastFetchedAt.getTime()) / 60000) : null;
  const label = isFetching ? 'Checking...' : minutesAgo === null ? 'Starting...' : minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">Monitoring active</span>
      <span className="text-[10px] text-emerald-500 dark:text-emerald-600 hidden sm:inline">· {label}</span>
    </div>
  );
};

// ── Upgrade Modal
const UpgradeModal: React.FC<{ onClose: () => void; onUpgrade: () => void; upgrading: boolean }> = ({ onClose, onUpgrade, upgrading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={e => e.stopPropagation()}
      className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-2xl w-full max-w-md overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">PayRecover Pro</span>
            </div>
            <h2 className="text-2xl font-black">Start recovering money today</h2>
            <p className="text-emerald-100 text-sm mt-1">Auto-recovery works while you sleep.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comparison */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Free */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-4">
            <p className="text-xs font-bold text-stone-400 uppercase mb-3">Free</p>
            <div className="space-y-2 text-xs text-stone-500 dark:text-stone-400">
              {['Track failed payments', 'Dashboard access', 'Manual retry'].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-stone-400 shrink-0" /> {f}
                </div>
              ))}
              {['Auto retry × 3', 'Email reminders', 'Recovery links'].map(f => (
                <div key={f} className="flex items-center gap-2 opacity-40 line-through">
                  <X className="w-3 h-3 shrink-0" /> {f}
                </div>
              ))}
            </div>
          </div>
          {/* Pro */}
          <div className="rounded-xl border-2 border-emerald-500 dark:border-emerald-600 p-4 bg-emerald-50/50 dark:bg-emerald-900/10">
            <p className="text-xs font-bold text-emerald-600 uppercase mb-3 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Pro
            </p>
            <div className="space-y-2 text-xs text-stone-600 dark:text-stone-300">
              {['Track failed payments', 'Dashboard access', 'Manual retry', 'Auto retry × 3', 'Email reminders', 'Recovery links'].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" /> {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Outcome guarantee */}
        <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 p-4">
          <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-emerald-500" /> How it works
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Contacts your customer <strong>3× automatically</strong> — immediately, after 24h, then 72h — each time with a direct payment link.
            <span className="block mt-1 font-semibold text-emerald-600 dark:text-emerald-400">On average, 1 in 3 failed payments is recovered.</span>
          </p>
        </div>

        <button
          onClick={onUpgrade}
          disabled={upgrading}
          className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {upgrading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {upgrading ? 'Activating...' : 'Activate Auto-Recovery'}
        </button>
        <p className="text-center text-[10px] text-stone-400">No contracts. Cancel anytime.</p>
      </div>
    </motion.div>
  </div>
);

// ── Onboarding Checklist
const OnboardingChecklist: React.FC<{
  hasSources: boolean; hasFailure: boolean; hasRecovery: boolean; plan: 'free' | 'paid';
  onOpenSources: () => void; onSimulate: () => void; onUpgrade: () => void; simulating: boolean;
}> = ({ hasSources, hasFailure, hasRecovery, plan, onOpenSources, onSimulate, onUpgrade, simulating }) => {
  const steps = [
    {
      done: hasSources,
      label: 'Connect Razorpay',
      sub: 'Add your API keys and webhook secret',
      action: onOpenSources,
      actionLabel: 'Connect',
    },
    {
      done: hasFailure,
      label: 'Receive a failed payment',
      sub: hasSources ? 'Trigger a test webhook, or simulate below' : 'Connect Razorpay first',
      action: hasSources ? onSimulate : undefined,
      actionLabel: simulating ? 'Simulating...' : 'Simulate',
    },
    {
      done: hasRecovery,
      label: 'See your first recovery',
      sub: plan === 'free' ? 'Upgrade to enable auto-recovery' : 'Worker will retry on next tick',
      action: plan === 'free' ? onUpgrade : undefined,
      actionLabel: 'Upgrade',
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  if (allDone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">Get started — {doneCount}/{steps.length} done</h3>
          <p className="text-xs text-stone-400 mt-0.5">Complete setup to reach your first recovered payment</p>
        </div>
        <div className="w-16 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className={cn(
            'flex items-center gap-3 p-3 rounded-lg border transition-all',
            step.done
              ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 opacity-60'
              : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800'
          )}>
            {step.done
              ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              : <Circle className="w-4 h-4 text-stone-300 dark:text-stone-600 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-semibold', step.done ? 'line-through text-stone-400' : 'text-stone-700 dark:text-stone-200')}>
                {step.label}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">{step.sub}</p>
            </div>
            {!step.done && step.action && (
              <button
                onClick={step.action}
                disabled={step.actionLabel === (simulating ? 'Simulating...' : null)}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shrink-0"
              >
                {step.actionLabel} <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ── Demo Panel
const DemoPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [lastDemo, setLastDemo] = useState<{ id: string; amount: number; name: string; product: string } | null>(null);

  const simulateMutation = useMutation({
    mutationFn: () => api.post('/demo/simulate-failure'),
    onSuccess: ({ data }) => {
      const d = data.data;
      setLastDemo({ id: d.id, amount: d.amount, name: d.customerName, product: d.product });
      toast.success(`Demo: ${d.customerName}'s ₹${(d.amount / 100).toLocaleString('en-IN')} payment failed`);
      queryClient.invalidateQueries({ queryKey: ['payments', page, PAGE_SIZE] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => toast.error('Demo failed'),
  });

  const recoverMutation = useMutation({
    mutationFn: (id: string) => api.post(`/demo/${id}/recover`),
    onSuccess: () => {
      toast.success('Demo payment recovered!');
      setLastDemo(null);
      queryClient.invalidateQueries({ queryKey: ['payments', page, PAGE_SIZE] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => toast.error('Recovery failed'),
  });

  return (
    <div className="border border-dashed border-stone-300 dark:border-stone-600 rounded-xl p-5 bg-stone-50/50 dark:bg-stone-800/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">Demo Mode</p>
            <p className="text-xs text-stone-400">Simulate a payment failure to see the full recovery flow</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastDemo && (
            <button
              onClick={() => recoverMutation.mutate(lastDemo.id)}
              disabled={recoverMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Simulate Recovery
            </button>
          )}
          <button
            onClick={() => simulateMutation.mutate()}
            disabled={simulateMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            {simulateMutation.isPending ? 'Simulating...' : 'Simulate Failure'}
          </button>
        </div>
      </div>
      {lastDemo && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700 text-xs text-stone-500 font-mono"
        >
          ↳ {lastDemo.name} · ₹{(lastDemo.amount / 100).toLocaleString('en-IN')} · {lastDemo.product}
          {' '}— <button onClick={() => navigate(`/payments/${lastDemo.id}`)} className="text-blue-500 hover:underline">view details</button>
        </motion.div>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'retrying' | 'recovered' | 'abandoned'>('ALL');
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Current user (plan)
  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data.data as AuthUser;
    },
    staleTime: 30000,
  });
  const plan = currentUser?.plan ?? 'free';
  const isPaid = plan === 'paid';

  // ── Sources (for onboarding)
  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data } = await api.get('/sources');
      return data.data as PaymentSource[];
    },
    staleTime: 30000,
  });

  // ── Stats
  const { data: stats, isFetching: statsFetching } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats');
      setLastFetchedAt(new Date());
      return data.data as DashboardStats;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // ── Payments (paginated)
  const { data: paymentsPage, isLoading, isFetching } = useQuery({
    queryKey: ['payments', page, PAGE_SIZE],
    queryFn: async () => {
      const { data } = await api.get('/payments', { params: { page, limit: PAGE_SIZE } });
      return data.data as { payments: FailedPayment[]; total: number; page: number; limit: number; totalPages: number };
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
  const payments = paymentsPage?.payments ?? [];
  const totalPages = paymentsPage?.totalPages ?? 1;

  // ── Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: () => api.post('/billing/upgrade'),
    onSuccess: () => {
      toast.success('Pro plan activated! Auto-recovery is now live.');
      setShowUpgradeModal(false);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: () => toast.error('Upgrade failed — please try again'),
  });

  // ── Manual retry
  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payments/${id}/retry`),
    onSuccess: () => {
      toast.success('Retry queued — reminder will send on next worker tick');
      queryClient.invalidateQueries({ queryKey: ['payments', page, PAGE_SIZE] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => toast.error('Failed to trigger retry'),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return payments
      .filter(p => {
        const matchesSearch =
          p.customerEmail.toLowerCase().includes(q) ||
          (p.customerName || '').toLowerCase().includes(q) ||
          p.paymentId.toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter as string;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'status') {
          const order: Record<string, number> = { pending: 0, retrying: 1, recovered: 2, abandoned: 3 };
          cmp = (order[a.status] ?? 4) - (order[b.status] ?? 4);
        } else if (sortKey === 'amount') {
          cmp = a.amount - b.amount;
        } else if (sortKey === 'createdAt') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortKey === 'retryCount') {
          cmp = a.retryCount - b.retryCount;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [payments, search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Derived
  const lostAmount = (stats?.totalFailedAmount ?? 0) - (stats?.totalRecoveredAmount ?? 0);
  const hasUnrecovered = lostAmount > 0;
  const hasGained = (stats?.totalRecoveredAmount ?? 0) > 0;
  const hasSources = sources.length > 0;
  const hasFailure = payments.length > 0;
  const hasRecovery = payments.some(p => p.status === 'recovered');
  const onboardingComplete = hasSources && hasFailure && hasRecovery;

  // Simulate failure handler (lifted up so onboarding can call it)
  const simulateFailureMutation = useMutation({
    mutationFn: () => api.post('/demo/simulate-failure'),
    onSuccess: () => {
      toast.success('Demo failure created');
      queryClient.invalidateQueries({ queryKey: ['payments', page, PAGE_SIZE] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => toast.error('Demo failed'),
  });

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
            onUpgrade={() => upgradeMutation.mutate()}
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

        {/* ── Onboarding checklist (hidden once complete) */}
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

        {/* ── HARD PAYWALL — free users with unrecovered payments */}
        <AnimatePresence>
          {!isPaid && hasUnrecovered && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
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
                      PayRecover can recover it automatically — but you're on the <strong>Free plan</strong>.
                      Auto-retry, email reminders, and recovery links require Pro.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all shrink-0 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" /> Upgrade to Recover
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Recovered banner (paid, show on good news) */}
        <AnimatePresence>
          {isPaid && hasUnrecovered && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 p-4 flex items-center gap-3"
            >
              <Shield className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                <strong>{formatAmount(lostAmount)}</strong> in active recovery — worker contacts customers automatically in the background.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Demo Panel */}
        <DemoPanel />

        {/* ── Hero recovered amount (shown once money is recovered) */}
        <AnimatePresence>
          {hasGained && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 text-white shadow-lg"
            >
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Recovered using PayRecover</p>
              <div className="text-5xl font-black tracking-tight">{formatAmount(stats?.totalRecoveredAmount ?? 0)}</div>
              <p className="text-emerald-100 text-sm mt-2">
                {stats?.totalRecovered} payment{(stats?.totalRecovered ?? 0) !== 1 ? 's' : ''} recovered
                {(stats?.recoveredThisMonth ?? 0) > 0 && (
                  <> · <strong className="text-white">{formatAmount(stats?.recoveredThisMonth ?? 0)}</strong> this month</>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <motion.div whileHover={{ y: -1 }} className="col-span-1 border border-warm-border dark:border-stone-700 rounded-xl p-5 bg-white dark:bg-stone-800 shadow-soft">
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <IndianRupee className="w-3 h-3" /> Failed
            </p>
            <div className="text-2xl font-bold text-red-500">{formatAmount(stats?.totalFailedAmount || 0)}</div>
            <p className="text-stone-400 text-xs mt-1">{stats?.totalFailed || 0} payments</p>
          </motion.div>

          <motion.div whileHover={{ y: -1 }} className="col-span-1 border border-warm-border dark:border-stone-700 rounded-xl p-5 bg-white dark:bg-stone-800 shadow-soft">
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <IndianRupee className="w-3 h-3" /> Recovered
            </p>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatAmount(stats?.totalRecoveredAmount || 0)}</div>
            <p className="text-stone-400 text-xs mt-1">{stats?.totalRecovered || 0} payments</p>
          </motion.div>

          <motion.div whileHover={{ y: -1 }} className="col-span-1 border border-warm-border dark:border-stone-700 rounded-xl p-5 bg-white dark:bg-stone-800 shadow-soft">
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Rate
            </p>
            <div className={cn('text-2xl font-bold', (stats?.recoveryRate || 0) >= 50
              ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500')}>
              {stats?.recoveryRate || 0}<span className="text-sm opacity-30 ml-0.5">%</span>
            </div>
            <p className="text-stone-400 text-xs mt-1">recovery rate</p>
          </motion.div>

          <motion.div whileHover={{ y: -1 }} className="col-span-1 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-5 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-soft">
            <p className="text-emerald-600 dark:text-emerald-500 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> This Week
            </p>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatAmount(stats?.recoveredThisWeek || 0)}</div>
            <p className="text-emerald-500/60 text-xs mt-1">recovered (7d)</p>
          </motion.div>

          <motion.div whileHover={{ y: -1 }} className="col-span-1 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-5 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-soft">
            <p className="text-emerald-600 dark:text-emerald-500 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> This Month
            </p>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatAmount(stats?.recoveredThisMonth || 0)}</div>
            <p className="text-emerald-500/60 text-xs mt-1">recovered (30d)</p>
          </motion.div>
        </div>

        {/* ── Outcome guarantee tagline (paid only, shown once they have data) */}
        {isPaid && payments.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
            <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            Contacts customers <strong className="text-stone-600 dark:text-stone-300">3× automatically</strong> — immediately, after 24h, then 72h — with a direct payment link each time.
          </div>
        )}

        {/* ── Toolbar */}
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-stone-600 transition-colors" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search payments"
              placeholder="Search by email, name, or payment ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-warm-border dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-sm font-medium focus:border-stone-400 dark:focus:border-stone-500 outline-none transition-all placeholder:text-stone-300 text-stone-700 dark:text-stone-200"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 p-1 rounded-xl flex items-center" role="group" aria-label="Filter by status">
              {(['ALL', 'pending', 'retrying', 'recovered', 'abandoned'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={statusFilter === s}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize',
                    statusFilter === s
                      ? 'bg-stone-700 dark:bg-stone-600 text-white shadow-sm'
                      : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="border border-warm-border dark:border-stone-700 p-1 rounded-xl flex items-center gap-1.5 px-3 bg-white dark:bg-stone-800" role="group" aria-label="Sort by">
              <span className="text-[10px] uppercase font-semibold text-stone-300 mr-1">Sort:</span>
              {(['status', 'amount', 'createdAt', 'retryCount'] as SortKey[]).map(key => (
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

        {/* ── Payment List */}
        <div className="glass rounded-2xl overflow-hidden shadow-2xl">
          {filtered.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-stone-100 dark:bg-stone-700 rounded-full flex items-center justify-center mx-auto">
                <IndianRupee className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black custom-gradient-text uppercase">No Payments Yet</h3>
              <p className="text-blue-400 dark:text-blue-500/60 max-w-xs mx-auto text-sm font-bold uppercase tracking-widest">
                {payments.length === 0
                  ? 'When Razorpay sends a payment.failed webhook, it will appear here.'
                  : 'No payments match your filter.'}
              </p>
              {payments.length === 0 && (
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  PayRecover contacts each customer 3× with a direct payment link.
                  <strong className="block mt-1 text-emerald-600 dark:text-emerald-400">On average, 1 in 3 failed payments is recovered.</strong>
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-indigo-500/5 dark:divide-white/5" aria-label="Failed payment list">
              <AnimatePresence mode="popLayout">
                {filtered.map((payment) => (
                  <motion.li
                    key={payment.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-300"
                  >
                    <div className="flex items-center p-5 sm:px-8 gap-6">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/payments/${payment.id}`)}>
                        <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                          <h4 className="text-base font-bold truncate group-hover:underline text-black dark:text-white transition-all">
                            {payment.customerName || payment.customerEmail}
                          </h4>
                          <StatusBadge status={payment.status} />
                          <span className="text-base font-bold text-stone-700 dark:text-stone-300">
                            {formatAmount(payment.amount, payment.currency)}
                          </span>
                          {payment.status === 'recovered' && payment.recoveredVia === 'link' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-emerald-500/5 text-emerald-500 border-emerald-200 dark:border-emerald-800">
                              via link
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-medium text-stone-400">
                          <span>{payment.customerEmail}</span>
                          <span>Retries: {payment.retryCount}/3</span>
                          <span>{daysSince(payment.createdAt)}d ago</span>
                          {payment.paymentId && (
                            <span className="font-mono text-[10px] text-stone-300">{payment.paymentId}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {payment.recoveryLinks[0] && (
                          <a
                            href={payment.recoveryLinks[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-2 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-blue-500/10 transition-all"
                            title="Open payment link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {['pending', 'retrying'].includes(payment.status) && (
                          isPaid ? (
                            <button
                              onClick={e => { e.stopPropagation(); retryMutation.mutate(payment.id); }}
                              disabled={retryMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300 border border-warm-border dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-all disabled:opacity-50"
                              title="Trigger retry now"
                            >
                              <RotateCcw className="w-3 h-3" /> Retry
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-400 border border-dashed border-stone-300 dark:border-stone-600 rounded-lg hover:border-emerald-400 hover:text-emerald-600 transition-all"
                              title="Upgrade to unlock auto-retry"
                            >
                              <Lock className="w-3 h-3" /> Retry
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {/* ── Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 dark:border-white/5">
              <span className="text-xs text-stone-400">
                Page {page} of {totalPages} · {paymentsPage?.total} total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 transition-all"
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
