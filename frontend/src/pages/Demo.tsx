import React, { FC, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, CreditCard, Download, FileText, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { formatAmount } from '../utils/format';
import { motion } from 'framer-motion';

const Demo: FC = () => {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceId) {
        setError('No invoice ID provided.');
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get(`/demo/invoice/${invoiceId}`);
        setInvoice(data.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load invoice.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  const handlePay = async () => {
    try {
      const { data } = await api.post(`/demo/pay/${invoiceId}`);
      if (data.data.url) {
        window.location.href = data.data.url;
      }
    } catch {
      alert('Failed to initiate checkout.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-stone-300"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <div className="glass-card max-w-md text-center space-y-4">
          <div className="bg-rose-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto">
             <FileText className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">Invoice not found</h1>
          <p className="text-stone-500">{error || 'This link may have expired or is incorrect.'}</p>
          <button onClick={() => window.location.href = '/'} className="btn-primary w-full justify-center">Go to Homepage</button>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';

  return (
    <div className="min-h-screen bg-cream selection:bg-emerald-100 selection:text-emerald-900 py-12 px-6">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Branding placeholder */}
        <div className="flex justify-center items-center gap-2 opacity-50">
           <div className="bg-stone-800 p-2 rounded-lg">
             <CheckCircle2 className="w-4 h-4 text-white" />
           </div>
           <span className="font-bold text-stone-800 uppercase tracking-widest text-xs">StripeFlow Secure Payment</span>
        </div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="glass-card !p-0 overflow-hidden shadow-2xl"
        >
          {/* Status Header */}
          <div className={`p-8 text-center text-white ${isPaid ? 'bg-emerald-500' : 'bg-stone-800'}`}>
             <h1 className="text-4xl font-black mb-2">{isPaid ? 'Invoice Paid' : formatAmount(invoice.amount)}</h1>
             <p className="font-bold uppercase tracking-widest text-[10px] opacity-70">
               {isPaid ? 'Receipt Available Below' : `Due by ${new Date(invoice.dueDate).toDateString()}`}
             </p>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-stone-50 pb-4">
                <div>
                   <label className="text-[10px] font-black uppercase text-stone-400 block mb-1">Description</label>
                   <p className="font-bold text-stone-800">{invoice.description}</p>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-stone-400 block mb-1 text-right">Invoice ID</label>
                   <p className="font-mono text-xs text-stone-500">#{invoice.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 py-4">
                <div>
                   <label className="text-[10px] font-black uppercase text-stone-400 block mb-1">Billed To</label>
                   <p className="font-bold text-stone-800">{invoice.clientEmail}</p>
                </div>
                <div className="text-right">
                   <label className="text-[10px] font-black uppercase text-stone-400 block mb-1">Issued By</label>
                   <p className="font-bold text-stone-800">{invoice.user?.name || 'Freelancer'}</p>
                </div>
              </div>
            </div>

            {isPaid ? (
              <div className="bg-emerald-50 rounded-2xl p-6 flex flex-col items-center gap-4 text-center border border-emerald-100">
                <div className="bg-emerald-500 p-3 rounded-full text-white">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900">Payment Confirmed</h3>
                  <p className="text-sm text-emerald-700/70">A receipt has been sent to your email.</p>
                </div>
                <button
                  onClick={() => window.open(invoice.pdfUrl, '_blank')}
                  className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-white px-6 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={handlePay}
                  className="w-full btn-primary !py-5 justify-center flex items-center gap-3 text-lg shadow-xl shadow-emerald-500/20"
                >
                  <CreditCard className="w-6 h-6" />
                  Pay with Stripe
                </button>
                <button
                  onClick={() => window.open(invoice.pdfUrl, '_blank')}
                  className="w-full py-4 text-center text-stone-400 hover:text-stone-800 font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Quote/Invoice PDF
                </button>
              </div>
            )}
          </div>

          <div className="bg-stone-50 p-6 flex justify-center items-center gap-6">
            <div className="flex items-center gap-1.5 opacity-40">
               <ShieldCheck className="w-4 h-4" />
               <span className="text-[8px] font-black uppercase tracking-widest">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-40">
               <CreditCard className="w-4 h-4" />
               <span className="text-[8px] font-black uppercase tracking-widest">Stripe Secure</span>
            </div>
          </div>
        </motion.div>

        <p className="text-center text-[10px] uppercase font-bold tracking-widest text-stone-400">
          Powered by StripeFlow &middot; Instant Freelancer Invoicing
        </p>
      </div>
    </div>
  );
};

export default Demo;
