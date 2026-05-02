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
    async function fetchInvoice() {
      if (!invoiceId) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get(`/demo/invoice/${invoiceId}`);
        setInvoice(data.data);
      } catch (err: any) {
        if (invoiceId) {
          setError(err.response?.data?.error || 'Failed to load invoice.');
        }
      } finally {
        setLoading(false);
      }
    }
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
    window.open(`${API_URL}/demo/invoice/${invoiceId}/pdf`, '_blank');
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
                    Create Test Invoice & Send Email
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
  const statusFromUrl = searchParams.get('status');

  return (
    <div className="min-h-screen bg-[#fdfcfb] selection:bg-emerald-100 selection:text-emerald-900 py-12 px-6">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
             <div className="bg-stone-800 p-2 rounded-lg">
               <CheckCircle2 className="w-4 h-4 text-white" />
             </div>
             <span className="font-bold text-stone-800 uppercase tracking-widest text-[10px]">InvoiceFlow Preview</span>
          </div>
          {isPaid && (
            <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" /> Paid
            </div>
          )}
        </div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-stone-100 rounded-[24px] overflow-hidden"
        >
          {/* Paper Header */}
          <div className="p-12 border-b border-stone-50 space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-stone-800 leading-tight">{invoice.user?.name || 'InvoiceFlow Demo'}</h2>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Digital Solutions</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <h1 className="text-3xl font-black text-stone-800 tracking-tighter">INVOICE</h1>
                <p className="text-xs font-mono text-stone-400">#{invoice.number}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-stone-50">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-stone-400 tracking-widest block">Bill To</label>
                <p className="font-bold text-stone-800 text-sm">{invoice.client?.name || invoice.clientEmail}</p>
                <p className="text-stone-400 font-medium text-xs">{invoice.clientEmail}</p>
              </div>
              <div className="text-right space-y-1">
                <label className="text-[9px] font-black uppercase text-stone-400 tracking-widest block">Due Date</label>
                <p className="font-bold text-stone-800 text-sm">{new Date(invoice.dueDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                <p className="text-stone-400 font-medium text-xs">Net 7 Days</p>
              </div>
            </div>
          </div>

          {/* Line Items Mock */}
          <div className="p-12 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[9px] font-black uppercase text-stone-300 tracking-widest border-b border-stone-50 pb-2">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-stone-800">{invoice.description}</p>
                  <p className="text-[10px] text-stone-400 font-medium italic">Standard Service Agreement</p>
                </div>
                <p className="font-black text-stone-800 text-lg">{formatAmount(invoice.amount)}</p>
              </div>
            </div>

            <div className="pt-8 border-t border-stone-50 flex justify-between items-center">
               <div className="space-y-1">
                 <p className="text-xs font-bold text-stone-800">Total Due</p>
                 <p className="text-[10px] text-stone-400 font-medium">Inclusive of all taxes</p>
               </div>
               <p className="text-3xl font-black text-stone-900 tracking-tighter">{formatAmount(invoice.amount)}</p>
            </div>

            <div className="space-y-4 pt-4">
              {isPaid || (statusFromUrl === 'paid') ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 rounded-2xl p-6 flex flex-col items-center gap-4 text-center border border-emerald-100">
                    <div className="bg-emerald-500 p-3 rounded-full text-white">
                       <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-900">Payment Confirmed</h3>
                      <p className="text-xs text-emerald-700/70">
                        {invoice.paidAt ? `Finalized on ${new Date(invoice.paidAt).toDateString()}` : 'Payment received. Updating records...'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadPdf}
                    className="w-full flex items-center justify-center gap-3 py-5 rounded-[18px] bg-stone-900 text-white font-black text-sm hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                  >
                    <Download className="w-5 h-5" /> Download Official PDF
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={handlePay}
                    className="w-full btn-primary !py-5 justify-center flex items-center gap-3 text-lg shadow-2xl shadow-emerald-500/20 group"
                  >
                    <CreditCard className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    Pay with Stripe
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="w-full py-4 text-center text-stone-400 hover:text-stone-800 font-bold transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                  >
                    <Download className="w-4 h-4" /> Preview PDF Version
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-stone-50/50 p-8 flex justify-between items-center border-t border-stone-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 opacity-30 grayscale">
                 <ShieldCheck className="w-3 h-3" />
                 <span className="text-[7px] font-black uppercase tracking-widest">Secure</span>
              </div>
              <div className="flex items-center gap-1.5 opacity-30 grayscale">
                 <CreditCard className="w-3 h-3" />
                 <span className="text-[7px] font-black uppercase tracking-widest">Encrypted</span>
              </div>
            </div>
            <p className="text-[7px] font-black uppercase tracking-widest text-stone-300">InvoiceFlow &copy; 2026</p>
          </div>
        </motion.div>

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
