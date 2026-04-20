import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import toast from 'react-hot-toast';
import type { AuthUser } from '../../App';

export const PAGE_SIZE = 10;

export function useDashboardData(currentUser: AuthUser | null) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'ALL';
  const sortKey = (searchParams.get('sortKey') as 'status' | 'amount' | 'createdAt' | 'retryCount') || 'createdAt';
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc';
  const sourceFilter = searchParams.get('source') || 'ALL';

  const setParam = (key: string, value: string, resetPage = true) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'ALL' && value !== 'createdAt' && !(key === 'sortDir' && value === 'desc')) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      if (resetPage) next.delete('page');
      return next;
    }, { replace: true });
  };

  const setPage = (p: number) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    return next;
  }, { replace: true });

  const setSearch = (v: string) => setParam('search', v);
  const setStatusFilter = (v: string) => setParam('status', v);
  const setSortKey = (v: 'status' | 'amount' | 'createdAt' | 'retryCount') => setParam('sortKey', v);
  const setSortDir = (v: 'asc' | 'desc') => setParam('sortDir', v);
  const setSourceFilter = (v: string) => setParam('source', v);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Plan logic derived from prop
  const isPaid = currentUser?.plan === 'starter' || currentUser?.plan === 'pro';
  const plan = currentUser?.plan || 'free';

  // ── Stats
  const { data: statsData, isFetching: statsFetching } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats');
      setLastFetchedAt(new Date());
      return data.data;
    },
    refetchInterval: 30000,
    staleTime: 5000,
  });

  // ── Clients
  const { data: sources = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data.data;
    },
    staleTime: 5000,
  });

  // ── Invoices (paginated)
  const { data: paymentsPage, isLoading, isFetching } = useQuery({
    queryKey: ['invoices', page, PAGE_SIZE, debouncedSearch, statusFilter, sourceFilter, sortKey, sortDir],
    queryFn: async () => {
      const { data } = await api.get('/invoices', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter.toLowerCase(),
          clientId: sourceFilter === 'ALL' ? undefined : sourceFilter,
          sortKey,
          sortDir,
        },
      });
      return data.data;
    },
    refetchInterval: 30000,
    staleTime: 5000,
  });

  // ── Mutations
  const upgradeMutation = useMutation({
    mutationFn: (gateway: 'razorpay' | 'stripe' = 'stripe') => 
      api.post('/billing/create-checkout', { plan: 'pro', gateway }),
    onSuccess: (response) => {
      const { checkoutUrl } = response.data.data;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        toast.success('Pro plan activated!');
        setShowUpgradeModal(false);
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }
    },
    onError: () => toast.error('Upgrade failed'),
  });

  const sendReminderMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/remind`),
    onSuccess: () => {
      toast.success('Reminder email sent');
    },
    onError: () => toast.error('Failed to send reminder'),
  });

  const stats = statsData || { totalVolume: 0, paidVolume: 0, paidRate: 0, counts: { pending: 0, paid: 0, overdue: 0 } };
  const payments = useMemo(() => {
    // If backend returns a flat array instead of { invoices: [] }, handle both
    if (Array.isArray(paymentsPage)) return paymentsPage;
    return paymentsPage?.invoices || paymentsPage || [];
  }, [paymentsPage]);

  return {
    state: { page, search, statusFilter, sourceFilter, sortKey, sortDir, showUpgradeModal, lastFetchedAt },
    setters: { setPage, setSearch, setStatusFilter, setSourceFilter, setSortKey, setSortDir, setShowUpgradeModal },
    data: { user: currentUser, isPaid, plan, stats, statsFetching, sources, paymentsPage, payments, isLoading, isFetching },
    mutations: { upgradeMutation, sendReminderMutation }
  };
}
