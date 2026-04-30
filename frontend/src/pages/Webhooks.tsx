import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Plus, Trash2, Send, Copy, Loader2, Webhook, CheckCircle2, XCircle, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/shared/ConfirmModal';
import { SettingsNav } from '../components/common/SettingsNav';

const ALL_EVENTS = [
  { id: 'payment.failed',    label: 'Payment Failed',    desc: 'New failed payment received' },
  { id: 'payment.retried',   label: 'Recovery Sent',     desc: 'Recovery attempt dispatched' },
  { id: 'payment.recovered', label: 'Payment Recovered', desc: 'Customer completed payment' },
  { id: 'payment.abandoned', label: 'Payment Abandoned', desc: 'All retries exhausted' },
] as const;

type EventId = typeof ALL_EVENTS[number]['id'];

interface WebhookEndpoint {
  id: string;
  url: string;
  events: EventId[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NewSecret {
  id: string;
  secret: string;
}

const SecretBanner: FC<{ item: NewSecret; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const copy = () => {
    navigator.clipboard.writeText(item.secret);
    toast.success('Secret copied');
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
            Signing secret — save this now. It will not be shown again.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Use this to verify the <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">x-InvoiceFlow-signature</code> header on incoming webhook deliveries.
          </p>
        </div>
        <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700 text-xs font-bold shrink-0">Dismiss</button>
      </div>
      <div className="flex items-center gap-3 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
        <code className="flex-1 text-xs font-mono text-stone-700 dark:text-stone-300 break-all">{item.secret}</code>
        <button onClick={copy} className="shrink-0 text-amber-600 hover:text-amber-800">
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

const AddForm: FC<{ onClose: () => void; onCreated: (ep: WebhookEndpoint & { secret: string }) => void }> = ({ onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<EventId>>(new Set(ALL_EVENTS.map(e => e.id)));

  const toggleEvent = (id: EventId) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: (data: { url: string; events: EventId[] }) => api.post('/webhook-endpoints', data),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      onCreated(data.data);
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create endpoint'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url) return toast.error('URL is required');
    if (selectedEvents.size === 0) return toast.error('Select at least one event');
    mutation.mutate({ url, events: Array.from(selectedEvents) });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-warm-border dark:border-stone-700 rounded-2xl p-6 bg-white dark:bg-stone-800 shadow-xl space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Add Webhook Endpoint</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Endpoint URL</label>
          <input
            type="url"
            placeholder="https://your-server.com/webhooks/InvoiceFlow"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
            className="w-full px-4 py-3 border border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 text-stone-700 dark:text-stone-200"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">Events to Subscribe</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_EVENTS.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => toggleEvent(ev.id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  selectedEvents.has(ev.id)
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600'
                    : 'border-warm-border dark:border-stone-700 bg-stone-50 dark:bg-stone-900/30 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${
                  selectedEvents.has(ev.id) ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300 dark:border-stone-600'
                }`}>
                  {selectedEvents.has(ev.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-100">{ev.label}</p>
                  <p className="text-xs text-stone-400 font-medium mt-0.5">{ev.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-stone-100 dark:border-stone-700">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-5 py-3 bg-stone-800 hover:bg-stone-900 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create Endpoint'}
          </button>
          <button type="button" onClick={onClose} className="px-5 py-3 text-stone-400 hover:text-stone-600 font-bold text-sm">
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
};

interface WebhookDelivery {
  id: string;
  event: string;
  status: string;
  responseCode: number | null;
  attempt: number;
  attemptedAt: string;
}

const DeliveryLog: FC<{ endpointId: string }> = ({ endpointId }) => {
  const { data, isLoading } = useQuery<WebhookDelivery[]>({
    queryKey: ['webhook-deliveries', endpointId],
    queryFn: async () => {
      const { data } = await api.get(`/webhook-endpoints/${endpointId}/deliveries`);
      return data.data;
    },
    staleTime: 30_000,
  });

  if (isLoading) return <div className="py-4 text-center text-xs text-stone-400 animate-pulse">Loading deliveries…</div>;
  if (!data?.length) return <div className="py-4 text-center text-xs text-stone-400">No deliveries yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-700 text-stone-400 font-semibold uppercase tracking-wider">
            <th className="py-2 px-3 text-left">Event</th>
            <th className="py-2 px-3 text-left">Status</th>
            <th className="py-2 px-3 text-left">Code</th>
            <th className="py-2 px-3 text-left">Attempt</th>
            <th className="py-2 px-3 text-left">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50 dark:divide-stone-800">
          {data.map(d => (
            <tr key={d.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
              <td className="py-2 px-3 font-mono text-stone-600 dark:text-stone-300">{d.event}</td>
              <td className="py-2 px-3">
                {d.status === 'success' ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 className="w-3 h-3" />success</span>
                ) : d.status === 'timeout' ? (
                  <span className="flex items-center gap-1 text-amber-500 font-semibold"><XCircle className="w-3 h-3" />timeout</span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-semibold"><XCircle className="w-3 h-3" />failed</span>
                )}
              </td>
              <td className="py-2 px-3 text-stone-400">{d.responseCode ?? '—'}</td>
              <td className="py-2 px-3 text-stone-400">#{d.attempt}</td>
              <td className="py-2 px-3 text-stone-400">{new Date(d.attemptedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const EndpointCard: FC<{ ep: WebhookEndpoint; onDelete: (id: string) => void }> = ({ ep, onDelete }) => {
  const queryClient = useQueryClient();
  const [showDeliveries, setShowDeliveries] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => api.patch(`/webhook-endpoints/${ep.id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] }),
    onError: () => toast.error('Failed to update endpoint'),
  });

  const testMutation = useMutation({
    mutationFn: () => api.post(`/webhook-endpoints/${ep.id}/test`),
    onSuccess: ({ data }) => {
      if (data.data?.ok) toast.success(`Test ping delivered (HTTP ${data.data.status})`);
      else toast.error(`Endpoint returned HTTP ${data.data?.status ?? '?'}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Test delivery failed'),
  });

  const copyUrl = () => {
    navigator.clipboard.writeText(ep.url);
    toast.success('URL copied');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="border border-warm-border dark:border-stone-800 rounded-3xl p-6 bg-white dark:bg-stone-900 shadow-soft space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`mt-1 w-3 h-3 rounded-full shrink-0 ${ep.active ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300 dark:bg-stone-600'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-stone-800 dark:text-stone-100 font-mono truncate">{ep.url}</p>
              <button onClick={copyUrl} className="text-stone-400 hover:text-stone-600 shrink-0">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-stone-400 font-medium mt-0.5">
              Added {new Date(ep.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            title="Send test ping"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-bold text-xs hover:bg-stone-50 dark:hover:bg-stone-800 transition-all disabled:opacity-50"
          >
            {testMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Test
          </button>
          <button
            onClick={() => toggleMutation.mutate(!ep.active)}
            disabled={toggleMutation.isPending}
            title={ep.active ? 'Pause endpoint' : 'Enable endpoint'}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
          >
            {ep.active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => onDelete(ep.id)}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 hover:border-rose-200 dark:hover:border-rose-800 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_EVENTS.map(ev => {
          const subscribed = ep.events.includes(ev.id);
          return (
            <span
              key={ev.id}
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                subscribed
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 opacity-50'
              }`}
            >
              {subscribed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {ev.label}
            </span>
          );
        })}
      </div>

      <button
        onClick={() => setShowDeliveries(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors pt-1"
      >
        {showDeliveries ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Delivery History
      </button>

      {showDeliveries && (
        <div className="border border-stone-100 dark:border-stone-700 rounded-xl overflow-hidden">
          <DeliveryLog endpointId={ep.id} />
        </div>
      )}
    </motion.div>
  );
};

const Webhooks: FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [newSecret, setNewSecret] = useState<NewSecret | null>(null);
  const [endpointToDelete, setEndpointToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: async () => {
      const { data } = await api.get('/webhook-endpoints');
      return data.data as WebhookEndpoint[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhook-endpoints/${id}`),
    onSuccess: () => {
      toast.success('Endpoint removed');
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      setEndpointToDelete(null);
    },
    onError: () => toast.error('Failed to remove endpoint'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 pb-20"
    >
      <SettingsNav />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-stone-900 dark:text-white tracking-tight">InvoiceFlow Webhooks</h1>
          <p className="text-stone-400 mt-2 font-medium">
            Get real-time notifications on your server when payment events occur.
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="group flex items-center gap-2 px-6 py-3.5 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-black rounded-2xl text-sm transition-all shadow-xl hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Add Endpoint
        </button>
      </div>

      <AnimatePresence>
        {newSecret && (
          <SecretBanner item={newSecret} onDismiss={() => setNewSecret(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <AddForm
            onClose={() => setShowForm(false)}
            onCreated={(ep) => {
              setNewSecret({ id: ep.id, secret: ep.secret });
              toast.success('Endpoint created');
            }}
          />
        )}
      </AnimatePresence>

      {/* How it works */}
      <div className="border border-stone-100 dark:border-stone-800 rounded-2xl p-5 bg-stone-50/50 dark:bg-stone-900/30 text-xs text-stone-500 dark:text-stone-400 space-y-2">
        <p className="font-bold text-stone-700 dark:text-stone-300 text-sm">Verifying webhook signatures</p>
        <p>Each delivery includes an <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">x-InvoiceFlow-signature: sha256=&lt;hex&gt;</code> header.</p>
        <p>Compute <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">HMAC-SHA256(secret, rawBody)</code> and compare — reject if they don't match.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-32 bg-stone-100 dark:bg-stone-900/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : endpoints.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-3xl p-20 text-center space-y-4 bg-stone-50/50 dark:bg-stone-900/20">
          <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mx-auto">
            <Webhook className="w-10 h-10 text-stone-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-200">No endpoints yet</h3>
            <p className="text-stone-400 text-sm max-w-sm mx-auto font-medium">
              Add an endpoint to start receiving real-time events when payments fail, recover, or are abandoned.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {endpoints.map(ep => (
              <EndpointCard key={ep.id} ep={ep} onDelete={setEndpointToDelete} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmModal
        isOpen={!!endpointToDelete}
        onClose={() => setEndpointToDelete(null)}
        onConfirm={() => endpointToDelete && deleteMutation.mutate(endpointToDelete)}
        loading={deleteMutation.isPending}
        title="Remove Endpoint?"
        message="InvoiceFlow will stop sending events to this URL. You can re-add it at any time."
        confirmText="Remove"
        isDestructive
      />
    </motion.div>
  );
};

export default Webhooks;
