import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Plus, Trash2, Copy, Loader2, Key, ToggleLeft, ToggleRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/shared/ConfirmModal';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  active: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface NewKey {
  id: string;
  key: string;
}

const KeyBanner: FC<{ item: NewKey; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const copy = () => {
    navigator.clipboard.writeText(item.key);
    toast.success('API key copied');
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="border border-amber-200 dark:border-amber-700 rounded-2xl p-5 bg-amber-50 dark:bg-amber-900/20 space-y-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            Your new API key — save this now. It will not be shown again.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Pass it as <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">x-api-key</code> header or{' '}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code> on API requests.
          </p>
        </div>
        <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700 text-xs font-bold shrink-0">Dismiss</button>
      </div>
      <div className="flex items-center gap-3 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
        <code className="flex-1 text-xs font-mono text-stone-700 dark:text-stone-300 break-all">{item.key}</code>
        <button onClick={copy} className="shrink-0 text-amber-600 hover:text-amber-800">
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

const AddForm: FC<{ onClose: () => void; onCreated: (k: NewKey) => void }> = ({ onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: (data: { name: string }) => api.post('/api-keys', data),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      onCreated({ id: data.data.id, key: data.data.key });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create API key'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    mutation.mutate({ name: name.trim() });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-warm-border dark:border-stone-700 rounded-2xl p-6 bg-white dark:bg-stone-800 shadow-xl"
    >
      <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-5">Create API Key</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Key Name</label>
          <input
            type="text"
            placeholder="e.g. Production Server, CI Pipeline"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            required
            className="w-full px-4 py-3 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 text-stone-700 dark:text-stone-200"
          />
        </div>
        <div className="flex gap-3 pt-2 border-t border-stone-100 dark:border-stone-700">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-5 py-3 bg-stone-800 hover:bg-stone-900 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create Key'}
          </button>
          <button type="button" onClick={onClose} className="px-5 py-3 text-stone-400 hover:text-stone-600 font-bold text-sm">
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const KeyCard: FC<{ apiKey: ApiKey; onDelete: (id: string) => void }> = ({ apiKey, onDelete }) => {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => api.patch(`/api-keys/${apiKey.id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
    onError: () => toast.error('Failed to update key'),
  });

  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="border border-warm-border dark:border-stone-800 rounded-2xl p-5 bg-white dark:bg-stone-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-3 h-3 rounded-full shrink-0 ${apiKey.active && !isExpired ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300 dark:bg-stone-600'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-stone-800 dark:text-stone-100">{apiKey.name}</p>
            {isExpired && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200 dark:bg-rose-900/20 dark:border-rose-800">
                Expired
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400 font-mono mt-0.5">{apiKey.prefix}••••••••••••••••••••••••</p>
          <p className="text-xs text-stone-400 font-medium mt-0.5">
            Created {new Date(apiKey.createdAt).toLocaleDateString()}
            {apiKey.lastUsedAt && ` · Last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`}
            {apiKey.expiresAt && ` · Expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => toggleMutation.mutate(!apiKey.active)}
          disabled={toggleMutation.isPending}
          title={apiKey.active ? 'Revoke key' : 'Enable key'}
          className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
        >
          {apiKey.active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
        </button>
        <button
          onClick={() => onDelete(apiKey.id)}
          className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 hover:border-rose-200 dark:hover:border-rose-800 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

const ApiKeys: FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data } = await api.get('/api-keys');
      return data.data as ApiKey[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      toast.success('API key revoked');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setKeyToDelete(null);
    },
    onError: () => toast.error('Failed to revoke key'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 pb-20"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-stone-900 dark:text-white tracking-tighter">API Keys</h1>
          <p className="text-stone-400 mt-2 font-medium">
            Authenticate programmatic requests to the PayRecover API from your server.
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="group flex items-center gap-2 px-6 py-3.5 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-black rounded-2xl text-sm transition-all shadow-xl hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          New API Key
        </button>
      </div>

      <AnimatePresence>
        {newKey && <KeyBanner item={newKey} onDismiss={() => setNewKey(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <AddForm
            onClose={() => setShowForm(false)}
            onCreated={(k) => { setNewKey(k); toast.success('API key created'); }}
          />
        )}
      </AnimatePresence>

      {/* Usage note */}
      <div className="border border-stone-100 dark:border-stone-800 rounded-2xl p-5 bg-stone-50/50 dark:bg-stone-900/30 text-xs text-stone-500 dark:text-stone-400 space-y-2">
        <p className="font-bold text-stone-700 dark:text-stone-300 text-sm">Authentication</p>
        <div className="space-y-1 font-mono">
          <p><span className="text-stone-400">x-api-key:</span> pr_••••••••••••••••••••••••</p>
          <p className="text-stone-400">— or —</p>
          <p><span className="text-stone-400">Authorization:</span> Bearer pr_••••••••••••••••••••••••</p>
        </div>
        <p className="font-sans">API keys bypass CSRF checks. Treat them like passwords and rotate regularly.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-stone-100 dark:bg-stone-900/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-3xl p-16 text-center space-y-4 bg-stone-50/50 dark:bg-stone-900/20">
          <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto">
            <Key className="w-8 h-8 text-stone-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-stone-800 dark:text-stone-200">No API keys</h3>
            <p className="text-stone-400 text-sm max-w-sm mx-auto font-medium">
              Create an API key to make authenticated requests to the PayRecover API from your server.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {apiKeys.map(k => <KeyCard key={k.id} apiKey={k} onDelete={setKeyToDelete} />)}
          </AnimatePresence>
        </div>
      )}

      <ConfirmModal
        isOpen={!!keyToDelete}
        onClose={() => setKeyToDelete(null)}
        onConfirm={() => keyToDelete && deleteMutation.mutate(keyToDelete)}
        loading={deleteMutation.isPending}
        title="Revoke API Key?"
        message="Any requests using this key will immediately be rejected. This cannot be undone."
        confirmText="Revoke"
        isDestructive
      />
    </motion.div>
  );
};

export default ApiKeys;
