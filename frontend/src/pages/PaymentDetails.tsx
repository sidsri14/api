import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { formatAmount, formatDate, daysSince } from '../utils/format';
import { StatusBadge } from '../components/dashboard/Badges';

interface Reminder {
  id: string;
  type: string;
  dayOffset: number;
  sentAt: string;
  status: string;
}

interface RecoveryLink {
  id: string;
  url: string;
  createdAt: string;
}

interface FailedPayment {
  id: string;
  paymentId: string;
  orderId?: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
  status: string;
  retryCount: number;
  lastRetryAt?: string;
  recoveredAt?: string;
  recoveryLinks: RecoveryLink[];
  metadata?: string;
  createdAt: string;
  reminders: Reminder[];
}

const MetricCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="border border-warm-border dark:border-stone-700 rounded-xl p-5 bg-white dark:bg-stone-800 shadow-soft">
    <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</p>
    <div className="text-2xl font-bold text-stone-800 dark:text-stone-100">{value}</div>
  </div>
);

const PaymentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const { data } = await api.get(`/payments/${id}`);
      return data.data as FailedPayment;
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-stone-200 dark:bg-stone-700 rounded w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-stone-400 font-medium">Payment not found.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* ── Back link */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* ── Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">
            {payment.customerName || payment.customerEmail}
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">{payment.customerEmail}</p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      {/* ── Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Amount" value={formatAmount(payment.amount, payment.currency)} />
        <MetricCard label="Retry Count" value={`${payment.retryCount} / 3`} />
        <MetricCard label="Days Since Failure" value={`${daysSince(payment.createdAt)}d`} />
        <MetricCard label="Status" value={<StatusBadge status={payment.status} />} />
      </div>

      {/* ── Recovery Links */}
      {payment.recoveryLinks.length > 0 && (
        <div className="border border-warm-border dark:border-stone-700 rounded-xl p-6 bg-white dark:bg-stone-800 shadow-soft space-y-3">
          <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Recovery Link{payment.recoveryLinks.length > 1 ? 's' : ''}
          </h2>
          {payment.recoveryLinks.map((link) => (
            <div key={link.id} className="flex items-center gap-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3">
              <span className="flex-1 text-sm font-mono text-stone-600 dark:text-stone-300 truncate">{link.url}</span>
              <button
                onClick={() => copyToClipboard(link.url)}
                className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors text-stone-400 hover:text-stone-700"
                title="Copy link"
              >
                <Copy className="w-4 h-4" />
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors text-stone-400 hover:text-blue-600"
                title="Open link"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* ── Reminder History */}
      <div className="border border-warm-border dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-700">
          <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Reminder History
          </h2>
        </div>
        {payment.reminders.length === 0 ? (
          <div className="p-10 text-center text-stone-400 text-sm">
            No reminders sent yet. Worker will process on its next tick.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-stone-400 font-semibold tracking-wider border-b border-stone-100 dark:border-stone-700">
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Day</th>
                <th className="px-6 py-3 text-left">Sent At</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
              {payment.reminders.map(r => (
                <tr key={r.id} className="hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors">
                  <td className="px-6 py-3 capitalize font-medium text-stone-700 dark:text-stone-200">{r.type}</td>
                  <td className="px-6 py-3 text-stone-500">Day {r.dayOffset}</td>
                  <td className="px-6 py-3 text-stone-500">
                    {formatDate(r.sentAt)}
                  </td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Raw Metadata (collapsed) */}
      {payment.metadata && (
        <details className="border border-warm-border dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 shadow-soft overflow-hidden">
          <summary className="px-6 py-4 text-sm font-semibold text-stone-500 cursor-pointer hover:text-stone-700 dark:hover:text-stone-300 transition-colors select-none">
            Raw Razorpay Payload
          </summary>
          <pre className="px-6 pb-6 text-xs font-mono text-stone-500 dark:text-stone-400 overflow-auto max-h-64">
            {(() => { try { return JSON.stringify(JSON.parse(payment.metadata), null, 2); } catch { return payment.metadata; } })()}
          </pre>
        </details>
      )}

      {/* ── Payment ID reference */}
      <div className="text-xs text-stone-300 dark:text-stone-600 font-mono">
        Payment ID: {payment.paymentId}
        {payment.orderId && ` · Order ID: ${payment.orderId}`}
        {payment.recoveredAt && ` · Recovered: ${formatDate(payment.recoveredAt)}`}
      </div>
    </motion.div>
  );
};

export default PaymentDetails;
