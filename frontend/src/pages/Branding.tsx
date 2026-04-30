import { useState } from 'react';
import type { FC } from 'react';
import { Palette, Mail, MessageSquare, Shield, Loader2, Save, Type, RotateCcw, Building2, Image } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import type { AuthUser } from '../App';
import { SettingsNav } from '../components/common/SettingsNav';

interface Props {
  user: AuthUser;
  onUpdateUser: (user: AuthUser) => void;
}

const Branding: FC<Props> = ({ user, onUpdateUser }) => {
  const [saving, setSaving] = useState(false);

  const brandObj = (() => {
    try { return JSON.parse(user.brandSettings || '{}'); } catch { return {}; }
  })();

  const [settings, setSettings] = useState({
    companyName: brandObj.companyName || '',
    supportEmail: brandObj.supportEmail || user.email,
    logoUrl: brandObj.logoUrl || '',
    accentColor: brandObj.accentColor || '#059669',
    emailTone: user.brandEmailTone || 'professional',
    emailSubject: user.brandEmailSubject || 'Payment recovery for {invoice_number}',
    showLogo: brandObj.showLogo !== false,
  });

  const handleSave = async () => {
    setSaving(true);
    const newBrandSettings = {
      companyName: settings.companyName,
      supportEmail: settings.supportEmail,
      logoUrl: settings.logoUrl,
      accentColor: settings.accentColor,
      showLogo: settings.showLogo,
    };
    try {
      await api.patch('/auth/branding', {
        brandEmailTone: settings.emailTone,
        brandEmailSubject: settings.emailSubject,
        brandSettings: newBrandSettings,
      });
      onUpdateUser({
        ...user,
        brandSettings: JSON.stringify(newBrandSettings),
        brandEmailTone: settings.emailTone,
        brandEmailSubject: settings.emailSubject,
      });
      toast.success('Branding updated successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const tones = [
    { id: 'professional', label: 'Professional', desc: 'Clear, concise, and respectful business tone.' },
    { id: 'friendly', label: 'Friendly', desc: 'Approachable and helpful, maintaining a good relationship.' },
    { id: 'urgent', label: 'Urgent', desc: 'High emphasis on immediate action and deadlines.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-12 pb-20"
    >
      <SettingsNav />
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-500">
            <Palette className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Visual Identity</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-stone-900 dark:text-white tracking-tight">
            Checkout Branding
          </h1>
          <p className="text-stone-400 font-medium max-w-xl">
            Control how your brand appears to your clients during the payment recovery process.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="group flex items-center gap-2 px-8 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Company Profile */}
          <section className="glass rounded-3xl p-8 border border-warm-border dark:border-stone-800 space-y-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-bold text-stone-800 dark:text-white">Organization Profile</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Display Name</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  placeholder="e.g. Acme Studio"
                  className="w-full px-5 py-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-warm-border dark:border-stone-700 font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  placeholder="support@company.com"
                  className="w-full px-5 py-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-warm-border dark:border-stone-700 font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                <Image className="w-3 h-3" /> Logo URL
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="url"
                  value={settings.logoUrl}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                  placeholder="https://yoursite.com/logo.png"
                  className="flex-1 px-5 py-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-warm-border dark:border-stone-700 font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="Logo preview"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                    className="w-12 h-12 rounded-xl object-contain border border-warm-border dark:border-stone-700 bg-white dark:bg-stone-800 p-1"
                  />
                )}
              </div>
              <p className="text-[10px] text-stone-400 italic">Shown in invoice emails and the Stripe checkout page.</p>
            </div>
          </section>

          {/* Email Tone */}
          <section className="glass rounded-3xl p-8 border border-warm-border dark:border-stone-800 space-y-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-bold text-stone-800 dark:text-white">Recovery Tone</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {tones.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setSettings({ ...settings, emailTone: tone.id })}
                  className={`p-6 rounded-3xl border text-left transition-all space-y-2 ${
                    settings.emailTone === tone.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 shadow-lg'
                      : 'border-warm-border dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/20 hover:border-stone-300 dark:hover:border-stone-400'
                  }`}
                >
                  <p className={`text-xs font-black uppercase tracking-widest ${settings.emailTone === tone.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500'}`}>
                    {tone.label}
                  </p>
                  <p className="text-xs text-stone-400 font-medium leading-relaxed">
                    {tone.desc}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Default Subject Line</label>
              <div className="relative">
                <input
                  type="text"
                  value={settings.emailSubject}
                  onChange={(e) => setSettings({ ...settings, emailSubject: e.target.value })}
                  className="w-full px-5 py-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-warm-border dark:border-stone-700 font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <Type className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
              </div>
              <p className="text-[10px] text-stone-400 mt-1 italic">Use placeholder <code>{'{invoice_number}'}</code> to personalize.</p>
            </div>
          </section>

          {/* Accent Color */}
          <section className="glass rounded-3xl p-8 border border-warm-border dark:border-stone-800 space-y-6">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-bold text-stone-800 dark:text-white">Brand Colors</h3>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 rounded-3xl overflow-hidden shadow-inner border border-stone-200 dark:border-stone-700">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                  className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-bold text-stone-800 dark:text-white">Primary Accent</p>
                <p className="text-xs text-stone-400">Used for buttons, links, and headers in recovery emails and checkout pages.</p>
                <code className="text-[10px] font-mono bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md text-stone-500 mt-2 inline-block">
                  {settings.accentColor.toUpperCase()}
                </code>
              </div>
              <button
                onClick={() => setSettings({ ...settings, accentColor: '#059669' })}
                className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-400"
                title="Reset to default"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>

        {/* Preview Sidebar */}
        <div className="space-y-6">
          <div className="sticky top-28 space-y-6">
            <div className="bg-stone-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
              <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-6 flex items-center gap-2">
                <Save className="w-3 h-3" /> Live Preview
              </h4>
              
              <div className="space-y-6 relative z-10">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-[10px] text-stone-500">2 min ago</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Subject</p>
                    <p className="text-xs font-bold truncate">{settings.emailSubject.replace('{invoice_number}', 'INV-001')}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-xl border border-stone-200 dark:border-stone-700">
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-12 h-12 bg-stone-100 dark:bg-stone-700 rounded-xl flex items-center justify-center overflow-hidden">
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <Building2 className="w-6 h-6 text-stone-400" />
                      )}
                    </div>
                    <p className="text-sm font-black text-stone-800 dark:text-stone-100">{settings.companyName || 'Your Brand'}</p>
                    <div className="h-2 w-3/4 bg-stone-200 dark:bg-stone-600 rounded-full" />
                    <div className="h-2 w-1/2 bg-stone-200 dark:bg-stone-600 rounded-full" />
                    <div
                      className="w-full h-8 rounded-lg mt-2 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-white shadow-lg mx-auto drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                      style={{ backgroundColor: settings.accentColor }}
                    >
                      Pay Now
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-700/50 flex items-center justify-between opacity-80">
                    <div className="flex flex-col gap-1">
                      <div className="h-1.5 w-12 bg-stone-200 dark:bg-stone-500 rounded-full" />
                      <div className="h-1.5 w-8 bg-stone-100 dark:bg-stone-600 rounded-full" />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-4 h-4 rounded bg-stone-100 dark:bg-stone-600" />
                      <div className="w-4 h-4 rounded bg-stone-100 dark:bg-stone-600" />
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-stone-500 text-center italic">
                  This preview reflects your current accent color and display name.
                </p>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 border border-warm-border dark:border-stone-800">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-4 h-4 text-emerald-500" />
                <h5 className="text-xs font-bold text-stone-800 dark:text-white uppercase tracking-widest">Premium Features</h5>
              </div>
              <ul className="space-y-3">
                {['Custom Domains', 'No InvoiceFlow Branding', 'Rich HTML Templates'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Branding;
