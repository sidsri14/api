import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, CheckCircle, Shield, RefreshCw } from 'lucide-react';

interface UpgradeModalProps {
  onClose: () => void;
  onUpgrade: (gateway: 'stripe' | 'razorpay') => void;
  upgrading: boolean;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ onClose, onUpgrade, upgrading }) => {
  // ♿ Accessibility: Handle Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
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
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">InvoiceFlow Pro</span>
              </div>
              <h2 id="upgrade-title" className="text-2xl font-black">Start recovering money today</h2>
              <p className="text-emerald-100 text-sm mt-1">Auto-recovery works while you sleep.</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close modal">
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

          <div className="space-y-3">
            <button
              onClick={() => onUpgrade('stripe')}
              disabled={upgrading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-60 flex flex-col items-center justify-center shadow-lg"
            >
              <div className="flex items-center gap-2">
                {upgrading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>Pay with Card (Stripe)</span>
              </div>
              <span className="text-[10px] opacity-70 font-medium">USD, EUR, GBP, more</span>
            </button>

            <button
              onClick={() => onUpgrade('razorpay')}
              disabled={upgrading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all disabled:opacity-60 flex flex-col items-center justify-center shadow-lg"
            >
              <div className="flex items-center gap-2">
                {upgrading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Pay with UPI/Netbanking</span>
              </div>
              <span className="text-[10px] opacity-70 font-medium">INR Only (Razorpay)</span>
            </button>
          </div>
          <p className="text-center text-[10px] text-stone-400">Secure checkout. Cancel anytime.</p>
        </div>
      </motion.div>
    </div>
  );
};
