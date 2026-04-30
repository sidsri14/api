import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2, LifeBuoy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { api } from '../api';

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact', form);
      setSubmitted(true);
      toast.success("Message sent! We'll get back to you soon.");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error;
      toast.error(msg ?? 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-5xl mx-auto py-20 px-6 sm:px-10"
    >
      <div className="grid md:grid-cols-2 gap-16 items-start">
        <div className="space-y-8">
          <div>
            <div className="inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 mb-6">
              <LifeBuoy className="w-8 h-8" />
            </div>
            <h1 className="text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">How can we help?</h1>
            <p className="text-xl text-stone-600 dark:text-stone-400 font-medium">
              Our engineering team is ready to assist with integration, billing, or feature requests.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Direct Support</p>
                <a href="mailto:support@InvoiceFlow.com" className="text-lg font-bold text-stone-800 dark:text-stone-100 hover:text-emerald-500 transition-colors">
                  support@InvoiceFlow.com
                </a>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Documentation</p>
                <a href="/docs" className="text-lg font-bold text-stone-800 dark:text-stone-100 hover:text-amber-500 transition-colors line-through decoration-stone-300">
                  Self-Service Guides (Soon)
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800 rounded-3xl p-8 border border-warm-border dark:border-stone-700 shadow-xl shadow-stone-200/50 dark:shadow-none">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label htmlFor="reg-name" className="text-xs font-semibold uppercase tracking-wider text-stone-400 ml-1">Full Name</label>
                  <input
                    required
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-transparent focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-stone-800 dark:text-stone-100"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-stone-400">Business Email</label>
                  <input
                    type="email"
                    required
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-transparent focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-stone-800 dark:text-stone-100"
                    placeholder="jane@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-stone-400">Message</label>
                  <textarea
                    required
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-5 py-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-transparent focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-stone-800 dark:text-stone-100 resize-none"
                    placeholder="How can we help? Provide details about your gateway or failed payment..."
                  />
                </div>
                <button
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-stone-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-xs hover:bg-stone-800 dark:hover:bg-indigo-500 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-glow">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-stone-800 dark:text-white">Message Dispatched!</h3>
                <p className="text-center text-stone-400 mb-8 font-medium text-sm">
                  We'll be in touch within 12 hours.
                </p>
                <p className="text-stone-500 dark:text-stone-400 font-medium">
                  We've received your message and our team is on it.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', message: '' }); }}
                  className="mt-8 text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors"
                >
                  Send another message
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default Contact;
