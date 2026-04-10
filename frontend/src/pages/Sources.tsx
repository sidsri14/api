import React, { useState } from 'react';
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
  keyId: string;
  createdAt: string;
  webhookUrl: string; // server-computed — never construct this client-side
  _count: { events: number };
}

const ConnectForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', keyId: '', keySecret: '', webhookSecret: '' });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/sources/connect', data),
    onSuccess: () => {
      toast.success('Razorpay account connected');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to connect account'),
  });

  const testMutation = useMutation({
    mutationFn: (data: { keyId: string; keySecret: string }) => api.post('/sources/test-connection', data),
    onSuccess: () => toast.success('Connection verified successfully!'),
    onError: (err: any) => toast.error(err.response?.data?.error || 'Verification failed'),
  });

  const handleTest = () => {
    if (!form.keyId || !form.keySecret) {
      toast.error('Key ID and Secret are required to test');
      return;
    }
    testMutation.mutate({ keyId: form.keyId, keySecret: form.keySecret });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.keyId || !form.keySecret || !form.webhookSecret) {
      toast.error('Key ID, Key Secret, and Webhook Secret are required');
      return;
    }
    mutation.mutate(form);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-warm-border dark:border-stone-700 rounded-xl p-6 bg-white dark:bg-stone-800 shadow-soft space-y-4"
    >
      <h2 className="text-base font-semibold text-stone-700 dark:text-stone-200">Connect Razorpay Account</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
            Display Name <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. My Store"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-2.5 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded-lg text-sm outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-colors text-stone-700 dark:text-stone-200 placeholder:text-stone-300"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
              Key ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="rzp_live_..."
              value={form.keyId}
              onChange={e => setForm(f => ({ ...f, keyId: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded-lg text-sm outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-colors font-mono text-stone-700 dark:text-stone-200 placeholder:text-stone-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
              Key Secret <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              placeholder="••••••••••••••••"
              value={form.keySecret}
              onChange={e => setForm(f => ({ ...f, keySecret: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded-lg text-sm outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-colors text-stone-700 dark:text-stone-200 placeholder:text-stone-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
            Webhook Secret <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            placeholder="From Razorpay Dashboard → Webhooks"
            value={form.webhookSecret}
            onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))}
            required
            className="w-full px-4 py-2.5 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded-lg text-sm outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-colors text-stone-700 dark:text-stone-200 placeholder:text-stone-300"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Connecting...' : 'Connect Account'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending}
            className="px-5 py-2.5 border border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold rounded-lg text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Test Connection
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-warm-border dark:border-stone-700 text-stone-600 dark:text-stone-400 font-semibold rounded-lg text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const Sources: React.FC = () => {
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
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">
            Payment Sources
          </h1>
          <p className="text-stone-400 mt-1 font-medium text-xs tracking-wide">
            Connect your Razorpay accounts to start recovering failed payments
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Connect Razorpay
        </button>
      </div>

      {/* Connect form */}
      <AnimatePresence>
        {showForm && <ConnectForm onClose={() => setShowForm(false)} />}
      </AnimatePresence>

      {/* Setup instructions */}
      <div className="border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-5 space-y-2">
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Setup Instructions
        </h3>
        <ol className="text-sm text-blue-600 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Connect your Razorpay account using the form above</li>
          <li>Copy the webhook URL shown on your connected source</li>
          <li>In Razorpay Dashboard → Settings → Webhooks, add the URL</li>
          <li>Enable events: <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">payment.failed</code> and <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">payment.captured</code></li>
          <li>Use the same webhook secret you entered above</li>
        </ol>
      </div>

      {/* Sources list */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-stone-100 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900 shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-1/4" />
                  <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-1/2" />
                </div>
                <div className="w-20 h-8 rounded-lg bg-stone-100 dark:bg-stone-800" />
              </div>
            </div>
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="border border-warm-border dark:border-stone-700 rounded-xl p-16 text-center space-y-3 bg-white dark:bg-stone-800">
          <div className="w-16 h-16 bg-stone-100 dark:bg-stone-700 rounded-full flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="font-bold text-stone-600 dark:text-stone-300">No sources connected</h3>
          <p className="text-stone-400 text-sm max-w-sm mx-auto">
            Connect your Razorpay account to start receiving webhooks and recovering failed payments.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sources.map(source => (
              <motion.div
                key={source.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="border border-warm-border dark:border-stone-700 rounded-xl p-5 bg-white dark:bg-stone-800 shadow-soft"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <h3 className="font-bold text-stone-800 dark:text-stone-100">
                        {source.name || 'Razorpay Account'}
                      </h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-600">
                        {source.provider}
                      </span>
                    </div>
                    <p className="text-stone-400 text-xs font-mono ml-5">{source.keyId}</p>
                    <p className="text-stone-400 text-xs ml-5">
                      {source._count.events} event{source._count.events !== 1 ? 's' : ''} received ·{' '}
                      Connected {new Date(source.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyWebhookUrl(source.webhookUrl)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 border border-warm-border dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      title="Copy webhook URL"
                    >
                      <Copy className="w-3.5 h-3.5" /> Webhook URL
                    </button>
                    <a
                      href="https://dashboard.razorpay.com/app/webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-blue-500/10 transition-all"
                      title="Open Razorpay Webhooks"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => setSourceToDelete(source.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-stone-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50"
                      title="Remove source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Webhook URL display */}
                <div className="mt-4 flex items-center gap-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-bold uppercase text-stone-400 shrink-0">Webhook URL</span>
                  <span className="flex-1 text-xs font-mono text-stone-500 dark:text-stone-400 truncate">
                    {source.webhookUrl}
                  </span>
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
        title="Remove Source?"
        message="Are you sure you want to disconnect this Razorpay account? Existing recovery jobs for this source will continue, but no new failures will be tracked."
        confirmText="Remove"
        isDestructive
      />
    </motion.div>
  );
};

export default Sources;
