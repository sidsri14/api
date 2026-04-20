import React, { FC, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, User, Mail, Phone, Building, Trash2, Edit2 } from 'lucide-react';
import { api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Clients: FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: ''
  });

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data.data;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/clients', formData);
      toast.success('Client added!');
      setShowAddModal(false);
      setFormData({ name: '', email: '', company: '', phone: '' });
      refetch();
    } catch {
      toast.error('Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will not delete their invoices.')) return;
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Client removed');
      refetch();
    } catch {
      toast.error('Failed to remove client');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Clients</h1>
          <p className="text-stone-400 text-sm mt-1">Manage your customer contact directory.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-40 glass rounded-2xl animate-pulse" />
            ))
          ) : !clients || clients.length === 0 ? (
            <div className="col-span-full py-20 text-center glass rounded-2xl">
              <User className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-stone-400 font-bold uppercase tracking-widest">No clients yet</h3>
            </div>
          ) : (
            clients.map((client: any) => (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass-card group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 group-hover:text-emerald-500 transition-colors">
                    <User className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-2 text-stone-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
    </div>
  );
};

export default Clients;
