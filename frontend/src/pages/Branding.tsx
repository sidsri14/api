import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Palette, Type, Image as ImageIcon, Check, Loader2, Save, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import type { AuthUser } from '../App';

interface BrandingSettings {
  logoUrl?: string;
  primaryColor?: string;
  companyName?: string;
  emailSignature?: string;
}

interface Props {
  user: AuthUser;
  onUpdateUser: (user: AuthUser) => void;
}

const Branding: FC<Props> = ({ user, onUpdateUser }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<BrandingSettings>({
    logoUrl: '',
    primaryColor: '#10b981',
    companyName: '',
    emailSignature: '',
  });

  useEffect(() => {
    if (user.brandSettings) {
      try {
        const settings = JSON.parse(user.brandSettings as string);
        setForm(prev => ({ ...prev, ...settings }));
      } catch (e) {
        console.error('Failed to parse brand settings', e);
      }
    }
  }, [user.brandSettings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.patch('/auth/branding', { brandSettings: JSON.stringify(form) });
      if (data.success) {
        toast.success('Branding settings saved!');
        onUpdateUser(data.data.user);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save branding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto pb-20 space-y-12"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-stone-900 dark:text-white tracking-tighter">
            Communication & Branding
          </h1>
          <p className="text-stone-400 mt-2 font-medium">
            Customize how your customers see your recovery efforts.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-4 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-black rounded-2xl text-sm transition-all shadow-xl disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Branding
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Editor */}
        <div className="lg:col-span-5 space-y-8">
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
              <ImageIcon className="w-5 h-5 text-stone-400" />
              <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Visual Identity</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Logo URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={form.logoUrl}
                  onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none focus:ring-2 focus:ring-stone-100 dark:focus:ring-stone-800 transition-all text-stone-700 dark:text-stone-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Primary Brand Color</label>
                <div className="flex gap-4">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="h-12 w-20 rounded-xl cursor-pointer bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="flex-1 px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
              <Type className="w-5 h-5 text-stone-400" />
              <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Email Copy</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Company Name</label>
                <input
                  type="text"
                  placeholder="Ex: Acme Corp"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none focus:ring-2 focus:ring-stone-100 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Email Signature</label>
                <textarea
                  rows={4}
                  placeholder="Ex: Best regards, The Acme Team"
                  value={form.emailSignature}
                  onChange={e => setForm(f => ({ ...f, emailSignature: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Preview */}
        <div className="lg:col-span-7">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center justify-between px-2">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <Eye className="w-4 h-4" /> Real-time Email Preview
              </p>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>

            <div className="border border-stone-200 dark:border-stone-800 rounded-3xl overflow-hidden bg-stone-50 dark:bg-stone-950 p-6 sm:p-12 shadow-inner">
              <div className="max-w-[500px] mx-auto bg-white dark:bg-stone-900 rounded-2xl shadow-xl overflow-hidden border border-white dark:border-stone-800">
                <div className="p-10 space-y-10">
                  <div className="h-10">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo" className="h-full object-contain" />
                    ) : (
                      <span className="text-2xl font-black italic tracking-tighter" style={{ color: form.primaryColor }}>
                        {form.companyName || 'PayRecover'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <p className="text-stone-800 dark:text-stone-200 text-lg font-medium leading-relaxed">
                      Your payment of <strong className="text-stone-900 dark:text-white">₹1,499</strong> couldn't be processed, but we've saved your order details.
                    </p>
                    <p className="text-stone-500 dark:text-stone-400 leading-relaxed">
                      You can complete your payment now in under 10 seconds using the link below. This link is valid for 7 days.
                    </p>
                  </div>

                  <div className="pt-4">
                    <div 
                      className="inline-block px-8 py-4 rounded-xl text-white font-bold text-center shadow-lg"
                      style={{ backgroundColor: form.primaryColor }}
                    >
                      Complete Payment Now
                    </div>
                  </div>

                  {form.emailSignature && (
                    <div className="pt-10 border-t border-stone-100 dark:border-stone-800 text-sm italic text-stone-400">
                      {form.emailSignature}
                    </div>
                  )}
                </div>
                <div className="px-10 py-6 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 text-center">
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                    Powered by PayRecover · Automated Recovery
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Branding;
