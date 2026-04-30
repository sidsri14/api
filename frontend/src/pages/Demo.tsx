import { type FC, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, CreditCard, Download, FileText, Sparkles } from 'lucide-react';
import { api, API_URL } from '../api';
import { formatAmount } from '../utils/format';
import { motion } from 'framer-motion';

const Demo: FC = () => {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('id') || searchParams.get('invoice');
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

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
      alert('Payment link unavailable. Please contact the sender.');
    }
  };

  const handleDownloadPdf = () => {
    window.open(`${API_URL}/invoices/${invoiceId}/pdf`, '_blank');
  };

  const handleCreateDemo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const { data } = await api.post('/demo/create', payload);
      setSuccess(data.data);
      // Auto-load the new invoice after 2 seconds
      setTimeout(() => {
        window.location.href = `/demo?id=${data.data.id}`;
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create demo invoice.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-stone-300"></div>
      </div>
    );
  }

    if (success) {
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card max-w-md w-full text-center space-y-6"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-stone-800">Invoice Created!</h2>
              <p className="text-stone-500 font-medium">{success.message}</p>
              <p className="text-xs text-stone-400 font-bold">Check your Resend dashboard to confirm delivery.</p>
            </div>
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-left">
              <label className="text-[10px] font-black uppercase text-stone-400 block mb-1">Stripe Payment Link</label>
              <a href={success.checkoutUrl} target="_blank" rel="noreferrer" className="text-emerald-600 font-mono text-xs break-all hover:underline block">
                {success.checkoutUrl}
              </a>
            </div>
            <p className="text-xs text-stone-400">Redirecting to preview in 3 seconds...</p>
          </motion.div>
        </div>
      );
    }

  if (!invoiceId || error || !invoice) {
    return (
      <div className="min-h-screen bg-cream py-12 px-6">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="flex justify-center items-center gap-2 opacity-50">
            <div className="bg-stone-800 p-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-stone-800 uppercase tracking-widest text-xs">InvoiceFlow Demo Generator</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card shadow-2xl space-y-8"
          >
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-stone-800">Create Test Invoice</h1>
              <p className="text-stone-500 font-medium">Experience the full flow: PDF generation, Resend email, and Stripe checkout.</p>
            </div>

            {error && !invoiceId && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100">{error}</div>}

            <form onSubmit={handleCreateDemo} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Amount (USD)</label>
                    <input name="amount" type="number" step="0.01" required defaultValue="49.99" className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Due Date</label>
                    <input name="dueDate" type="date" required defaultValue={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Client Email</label>
                  <input name="clientEmail" type="email" required placeholder="your-email@example.com" className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Description</label>
                  <input name="description" type="text" required defaultValue="Premium Support - Monthly" className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold" />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full btn-primary !py-5 justify-center flex items-center gap-3 text-lg shadow-xl shadow-emerald-500/20"
              >
                {creating ? 'Generating Flow...' : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Create Test Invoice & Get Link
                  </>
                )}
              </button>
            </form>
          </motion.div>

          <p className="text-center text-[10px] uppercase font-bold tracking-widest text-stone-400">
            Global Payments &middot; No Login Required &middot; Test Mode
          </p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'PAID';

  return (
    <div className="min-h-screen bg-cream selection:bg-emerald-100 selection:text-emerald-900 py-12 px-6">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex justify-center items-center gap-2 opacity-50">
           <div className="bg-stone-800 p-2 rounded-lg">
             <CheckCircle2 className="w-4 h-4 text-white" />
           </div>
           <span className="font-bold text-stone-800 uppercase tracking-widest text-xs">InvoiceFlow Secure Payment</span>
        </div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="glass-card !p-0 overflow-hidden shadow-2xl"
        >
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
                   <label className="text-[10px] font-black uppercase text-stone-400 block mb-1 text-right">Invoice #</label>
                   <p className="font-mono text-xs text-stone-500">{invoice.number}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 py-4">
                <div>
                   <label className="text-[10px] font-black uppercase text-stone-400 block mb-1">Billed To</label>
                   <p className="font-bold text-stone-800">{invoice.client?.name || invoice.clientEmail}</p>
                   {invoice.client?.company && <p className="text-xs text-stone-500">{invoice.client.company}</p>}
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
                  <p className="text-sm text-emerald-700/70">
                    {invoice.paidAt ? `Paid on ${new Date(invoice.paidAt).toDateString()}` : 'A receipt has been sent to your email.'}
                  </p>
                </div>
                <button
                  onClick={handleDownloadPdf}
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
                  Pay {formatAmount(invoice.amount)} with Stripe
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="w-full py-4 text-center text-stone-400 hover:text-stone-800 font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Invoice PDF
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
          Powered by InvoiceFlow &middot; Instant Freelancer Invoicing
        </p>
      </div>
    </div>
  );
};

export default Demo;
