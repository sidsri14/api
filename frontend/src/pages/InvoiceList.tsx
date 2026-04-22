import { type FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, ExternalLink, Trash2, Clock } from 'lucide-react';
import { api, API_URL } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAmount } from '../utils/format';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/shared/ConfirmModal';

const InvoiceList: FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; desc: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await api.get('/invoices');
      return data.data.invoices;
    }
  });

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/invoices/${confirmDelete.id}`);
      toast.success('Invoice deleted');
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to delete invoice';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'OVERDUE': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'CANCELLED': return 'bg-stone-500/10 text-stone-500 border-stone-500/20';
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Invoices</h1>
          <p className="text-stone-400 text-sm mt-1">Manage and track your freelancer invoices.</p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Create Invoice
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-50 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Invoice / Client</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Due Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50 dark:divide-stone-800">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8">
                        <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-full opacity-50" />
                      </td>
                    </tr>
                  ))
                ) : !invoices || invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <FileText className="w-12 h-12 text-stone-400" />
                        <h3 className="text-xl font-black uppercase tracking-widest">No Invoices Found</h3>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice: any) => (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-all duration-300 group cursor-pointer"
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 group-hover:text-emerald-500 transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-stone-800 dark:text-stone-100">{invoice.description}</p>
                            <p className="text-xs text-stone-400">{invoice.clientEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                          getStatusColor(invoice.status)
                        )}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(invoice.dueDate).toDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-stone-800 dark:text-stone-100">
                        {formatAmount(invoice.amount)}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${invoice.id}`); }}
                            className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 transition-all"
                            title="View Invoice"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(`${API_URL}/invoices/${invoice.id}/pdf`, '_blank'); }}
                            className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-emerald-500 transition-all"
                            title="Download PDF"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: invoice.id, desc: invoice.description }); }}
                            className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/10 text-stone-400 hover:text-rose-500 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message={`Delete "${confirmDelete?.desc}"? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
        loading={deleting}
      />
    </div>
  );
};

export default InvoiceList;
