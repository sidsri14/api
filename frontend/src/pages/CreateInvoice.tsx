import { type FC, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Send, Users, DollarSign, Calendar, FileText } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

const CreateInvoice: FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    clientEmail: '',
    description: '',
    amount: '',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'USD'
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data.data;
    }
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Generating invoice & Stripe link...');
    try {
      const payload = {
        ...formData,
        amount: Math.round(parseFloat(formData.amount) * 100) // Convert to cents
      };
      await api.post('/invoices', payload);
      toast.success('Invoice created and email sent!', { id: toastId });
      navigate('/invoices');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create invoice', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <button
        onClick={() => navigate('/invoices')}
        className="flex items-center gap-2 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-all font-bold text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Invoices
      </button>

      <div>
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Create New Invoice</h1>
        <p className="text-stone-400 text-sm mt-1">Branded PDF + Stripe Checkout will be generated automatically.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Select Client (Optional)
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => {
                const client = clients?.find((c: any) => c.id === e.target.value);
                setFormData({
                  ...formData,
                  clientId: e.target.value,
                  clientEmail: client ? client.email : formData.clientEmail
                });
              }}
              className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            >
              <option value="">-- Choose an existing client --</option>
              {clients?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              Client Email Address
            </label>
            <input
              type="email"
              required
              placeholder="billing@client.com"
              value={formData.clientEmail}
              onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Invoice Description
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Website Development - Phase 1"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" /> Amount (USD)
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Due Date
            </label>
            <input
              type="date"
              required
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>
        </div>

        <div className="pt-6 flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1 justify-center py-4 text-base"
          >
            {loading ? 'Processing...' : (
              <>
                <Send className="w-5 h-5" />
                Generate & Send Invoice
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-8 py-4 rounded-xl border border-stone-100 dark:border-stone-800 font-bold text-stone-500 hover:text-stone-800 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInvoice;
