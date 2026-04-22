import { type FC, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, User, Mail, Phone, Building, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/shared/ConfirmModal';

const Clients: FC = () => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: ''
  });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const queryClient = useQueryClient();
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data.data;
    }
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/clients', formData);
      toast.success('Client added!');
      setShowAddModal(false);
      setFormData({ name: '', email: '', company: '', phone: '' });
      invalidateAll();
    } catch {
      toast.error('Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/clients/${confirmDelete.id}`);
      toast.success('Client removed');
      setConfirmDelete(null);
      invalidateAll();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to remove client';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const [search, setSearch] = useState('');

  const filteredClients = clients?.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Clients</h1>
          <p className="text-stone-400 text-sm mt-1">Manage your customer contact directory.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-5 py-2.5 rounded-xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium transition-all"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary shrink-0"
          >
            <Plus className="w-5 h-5" />
            Add Client
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-40 glass rounded-2xl animate-pulse" />
            ))
          ) : filteredClients.length === 0 ? (
            <div className="col-span-full py-20 text-center glass rounded-2xl">
              <User className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-stone-400 font-bold uppercase tracking-widest">
                {search ? 'No clients match your search' : 'No clients yet'}
              </h3>
            </div>
          ) : (
            filteredClients.map((client: any) => (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass-card group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 group-hover:text-emerald-500 transition-colors">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => navigate(`/invoices/new?clientId=${client.id}`)}
                      className="p-2 text-stone-300 hover:text-emerald-500 transition-colors"
                      title="Create Invoice"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: client.id, name: client.name })}
                      className="p-2 text-stone-300 hover:text-rose-500 transition-colors"
                      title="Delete Client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">{client.name}</h3>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Mail className="w-3.5 h-3.5" /> {client.email}
                  </div>
                  {client.company && (
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Building className="w-3.5 h-3.5" /> {client.company}
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Phone className="w-3.5 h-3.5" /> {client.phone}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl p-8 border border-warm-border dark:border-stone-800 shadow-2xl"
          >
            <h2 className="text-2xl font-bold mb-6">Add New Client</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="label">Company (Optional)</label>
                <input
                  value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  className="input"
                  placeholder="ACME Inc."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 justify-center"
                >
                  {loading ? 'Adding...' : 'Add Client'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 rounded-xl border border-stone-100 dark:border-stone-800 text-stone-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Delete ${confirmDelete?.name}? All their invoices will also be permanently deleted.`}
        confirmText="Delete"
        isDestructive
        loading={deleting}
      />
    </div>
  );
};

export default Clients;
