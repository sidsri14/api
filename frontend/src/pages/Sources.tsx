import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Plus, Trash2, Zap, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/shared/ConfirmModal';




interface PaymentSource {
  id: string;
  provider: string;
  name?: string;
  createdAt: string;
  webhookUrl: string;
  _count: { events: number };
  // credentials are not returned for security, but we might show partial keyId if needed
  // For now, keyId was removed from schema, but we can store it in metadata if we want.
  // We'll just show the provider and name.
}

const PROVIDERS = [
  { id: 'razorpay', name: 'Razorpay', icon: Zap, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { id: 'stripe', name: 'Stripe', icon: Zap, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
];

const ConnectForm: FC<{ onClose: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<'razorpay' | 'stripe'>('razorpay');
  const [form, setForm] = useState({ 
    name: '', 
    keyId: '', 
    keySecret: '', 
    apiKey: '',
    webhookSecret: '' 
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/sources/connect', data),
    onSuccess: () => {
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} account connected`);
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      onClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to connect account');
    },
  });

  const testMutation = useMutation({
    mutationFn: (data: any) => api.post('/sources/test-connection', data),
    onSuccess: () => toast.success('Connection verified successfully!'),
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Verification failed');
    },
  });

  const handleTest = () => {
    const data: any = { provider, credentials: {} };
    if (provider === 'razorpay') {
      if (!form.keyId || !form.keySecret) return toast.error('Key ID and Secret required');
      data.credentials = { keyId: form.keyId, keySecret: form.keySecret };
    } else {
      if (!form.apiKey) return toast.error('API Key required');
      data.credentials = { apiKey: form.apiKey };
    }
    testMutation.mutate(data);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const data: any = { 
      provider, 
      name: form.name, 
      webhookSecret: form.webhookSecret,
      credentials: {} 
    };

    if (provider === 'razorpay') {
      if (!form.keyId || !form.keySecret) return toast.error('Key ID and Secret required');
      data.credentials = { keyId: form.keyId, keySecret: form.keySecret };
    } else {
      if (!form.apiKey) return toast.error('API Key required');
      data.credentials = { apiKey: form.apiKey };
    }

    if (!form.webhookSecret) return toast.error('Webhook Secret is required');
    mutation.mutate(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-warm-border dark:border-stone-700 rounded-2xl p-6 bg-white dark:bg-stone-800 shadow-xl space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Connect Payment Source</h2>
        <div className="flex bg-stone-100 dark:bg-stone-900 p-1 rounded-xl">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                provider === p.id 
                  ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-white shadow-sm' 
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Display Name</label>
          <input
            type="text"
            placeholder="e.g. My Global Store"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-3 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-all text-stone-700 dark:text-stone-200"
          />
        </div>

        {provider === 'razorpay' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Key ID</label>
              <input
                type="text"
                placeholder="rzp_live_..."
                value={form.keyId}
                onChange={e => setForm(f => ({ ...f, keyId: e.target.value }))}
                className="w-full px-4 py-3 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-stone-200"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Key Secret</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={form.keySecret}
                onChange={e => setForm(f => ({ ...f, keySecret: e.target.value }))}
                className="w-full px-4 py-3 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Secret API Key</label>
            <input
              type="password"
              placeholder="sk_live_..."
              value={form.apiKey}
              onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              className="w-full px-4 py-3 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-stone-200"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Webhook Secret</label>
          <input
            type="password"
            placeholder={provider === 'stripe' ? 'whsec_...' : 'From Dashboard'}
            value={form.webhookSecret}
            onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))}
            className="w-full px-4 py-3 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-stone-100 dark:border-stone-700">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-5 py-3 bg-stone-800 hover:bg-stone-900 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {mutation.isPending ? 'Connecting...' : 'Connect Source'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending}
            className="px-5 py-3 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-bold rounded-xl text-sm hover:bg-stone-50 transition-all flex items-center gap-2"
          >
            {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Test
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 text-stone-400 hover:text-stone-600 font-bold text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const Sources: FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data } = await api.get('/sources');
      return data.data as PaymentSource[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sources/${id}`),
    onSuccess: () => {
      toast.success('Source removed');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setSourceToDelete(null);
    },
    onError: () => toast.error('Failed to remove source'),
  });

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-stone-900 dark:text-white tracking-tighter">
            Payment Sources
          </h1>
          <p className="text-stone-400 mt-2 font-medium">
            Connect Razorpay or Stripe to recover global failed payments automatically.
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="group flex items-center gap-2 px-6 py-3.5 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-black rounded-2xl text-sm transition-all shadow-xl hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Add New Source
        </button>
      </div>

      {/* Connect form */}
      <AnimatePresence>
        {showForm && <ConnectForm onClose={() => setShowForm(false)} />}
      </AnimatePresence>

      {/* Sources list */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-40 bg-stone-100 dark:bg-stone-900/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-3xl p-20 text-center space-y-4 bg-stone-50/50 dark:bg-stone-900/20">
          <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mx-auto">
            <Plus className="w-10 h-10 text-stone-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-200">No sources active</h3>
            <p className="text-stone-400 text-sm max-w-sm mx-auto font-medium">
              You haven't connected any payment gateways yet. Click the button above to get started with Stripe or Razorpay.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {sources.map(source => (
              <motion.div
                key={source.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative border border-warm-border dark:border-stone-800 rounded-3xl p-8 bg-white dark:bg-stone-900 shadow-soft hover:shadow-xl transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${
                      source.provider === 'stripe' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      <Zap className="w-8 h-8 fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-black text-stone-900 dark:text-white">
                          {source.name || `${source.provider.charAt(0).toUpperCase() + source.provider.slice(1)} Account`}
                        </h3>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          source.provider === 'stripe' 
                            ? 'bg-blue-50 text-blue-500 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                            : 'bg-emerald-50 text-emerald-500 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                        }`}>
                          {source.provider}
                        </span>
                      </div>
                      <p className="text-stone-400 text-sm font-medium mt-1">
                        {source._count.events} events captured · Since {new Date(source.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => copyWebhookUrl(source.webhookUrl)}
                      className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-2xl transition-all"
                    >
                      <Copy className="w-4 h-4" /> Webhook URL
                    </button>
                    <button
                      onClick={() => setSourceToDelete(source.id)}
                      className="p-3.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800 flex items-center gap-3">
                   <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Setup Status:</p>
                   <div className="flex items-center gap-2 text-emerald-500">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-xs font-bold">Active & Listening</span>
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmModal
        isOpen={!!sourceToDelete}
        onClose={() => setSourceToDelete(null)}
        onConfirm={() => sourceToDelete && deleteMutation.mutate(sourceToDelete)}
        loading={deleteMutation.isPending}
        title="Disconnect Source?"
        message="This will immediately stop tracking failed payments from this gateway. Existing recovery links will remain active until they expire."
        confirmText="Disconnect"
        isDestructive
      />
    </motion.div>
  );
};

export default Sources;

export default Sources;
