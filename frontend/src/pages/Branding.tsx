import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Type, Image as ImageIcon, Loader2, Save, Eye, Mail, Terminal, ExternalLink, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const [testLoading, setTestLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<BrandingSettings>({
    logoUrl: '',
    primaryColor: '#10b981',
    companyName: '',
    emailSignature: '',
  });
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTone, setEmailTone] = useState<'professional' | 'friendly' | 'urgent'>('professional');
  const [testPhone, setTestPhone] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  useEffect(() => {
    if (user.brandSettings) {
      try {
        const settings = typeof user.brandSettings === 'string' 
          ? JSON.parse(user.brandSettings) 
          : user.brandSettings;
        setForm(prev => ({ ...prev, ...settings }));
      } catch (e) {
        console.error('Failed to parse brand settings', e);
      }
    }
    if (user.brandEmailSubject) setEmailSubject(user.brandEmailSubject);
    if (user.brandEmailTone) setEmailTone(user.brandEmailTone as any);
  }, [user.brandSettings, user.brandEmailSubject, user.brandEmailTone]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.patch('/auth/branding', { 
        brandSettings: form, // Backend expects object now or string? (Previously it was JSON.stringify(form))
        brandEmailSubject: emailSubject,
        brandEmailTone: emailTone
      });
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

  const handleSendTest = async () => {
    setTestLoading(true);
    try {
      await api.post('/auth/test-email');
      toast.success('Test email sent to ' + user.email);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send test email');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!testPhone) return toast.error('Enter a phone number');
    setSmsLoading(true);
    try {
      await api.post('/auth/test-sms', { phoneNumber: testPhone });
      toast.success('Test SMS sent to ' + testPhone);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send test SMS');
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    if (!testPhone) return toast.error('Enter a phone number');
    setWhatsappLoading(true);
    try {
      await api.post('/auth/test-whatsapp', { phoneNumber: testPhone });
      toast.success('Test WhatsApp sent to ' + testPhone);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send test WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const webhookUrl = `${window.location.protocol}//pay-recovery-web-production.up.railway.app/api/webhooks/razorpay`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Webhook URL copied');
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

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Custom Subject Line (optional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Your {{amount}} payment is waiting"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm"
                  />
                  <p className="text-[10px] text-stone-400 font-medium pl-1 italic">Use {"{{amount}}"} as a placeholder for the payment amount.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Email Tone</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['professional', 'friendly', 'urgent'].map(tone => (
                      <button
                        key={tone}
                        onClick={() => setEmailTone(tone as any)}
                        className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          emailTone === tone 
                            ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' 
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-stone-600'
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
              <Mail className="w-5 h-5 text-stone-400" />
              <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Test Communication</h2>
            </div>
            
            <div className="space-y-8">
              {/* Email Test */}
              <div className="bg-stone-50 dark:bg-stone-900/50 p-6 rounded-2xl border border-stone-100 dark:border-stone-800 space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-800 dark:text-stone-200 mb-2">Email Testing</h3>
                  <p className="text-[10px] text-stone-500 leading-normal font-medium">
                    Verify your Branding and SMTP configuration by sending a sample recovery email.
                  </p>
                </div>
                <button
                  onClick={handleSendTest}
                  disabled={testLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-xs hover:bg-stone-50 dark:hover:bg-stone-700 transition-all shadow-sm"
                >
                  {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Email to {user.email}
                </button>
              </div>

              {/* SMS/WA Test */}
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-800 dark:text-indigo-400 mb-2">Mobile Recovery (Pro)</h3>
                  <p className="text-[10px] text-stone-500 dark:text-indigo-900/40 leading-normal font-medium">
                    Test your Twilio integration for SMS and WhatsApp. Requires E.164 format (ex: +919876543210).
                  </p>
                </div>
                
                <input
                  type="text"
                  placeholder="+91..."
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/30 bg-white dark:bg-stone-900 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 transition-all text-xs font-mono"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSendTestSms}
                    disabled={smsLoading}
                    className="flex items-center justify-center gap-2 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold rounded-xl text-xs hover:bg-black transition-all shadow-lg"
                  >
                    {smsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test SMS'}
                  </button>
                  <button
                    onClick={handleSendTestWhatsApp}
                    disabled={whatsappLoading}
                    className="flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white font-bold rounded-xl text-xs hover:opacity-90 transition-all shadow-lg"
                  >
                    {whatsappLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test WhatsApp'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
              <Terminal className="w-5 h-5 text-stone-400" />
              <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Webhook Setup</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Your Unique Webhook URL</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 bg-stone-100 dark:bg-stone-900/80 rounded-xl font-mono text-[10px] truncate text-stone-500 border border-stone-200 dark:border-stone-800">
                    {webhookUrl}
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="px-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 transition-all shadow-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-stone-400" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                 <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                   <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-normal">
                     Step 1: Go to your payment provider's dashboard (Razorpay or Stripe).<br/>
                     Step 2: Add a new Webhook with the URL above.<br/>
                     Step 3: Select the "payment.failed" event.<br/>
                     Step 4: Save and everything will be captured automatically.
                   </p>
                 </div>
                 <a 
                   href="https://razorpay.com/docs/webhooks/setup/" 
                   target="_blank" 
                   rel="noreferrer"
                   className="flex items-center justify-between p-4 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl hover:border-stone-200 transition-all text-[10px] font-bold text-stone-600 dark:text-stone-400"
                 >
                   Razorpay Webhook Guide
                   <ExternalLink className="w-3 h-3" />
                 </a>
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
                  <div className="flex border-b border-stone-100 dark:border-stone-800 pb-3 mb-6">
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest truncate">
                      Subject: {emailSubject.replace('{{amount}}', '₹1,499') || (
                        emailTone === 'urgent' ? 'Action Required: Your ₹1,499 payment failed' :
                        emailTone === 'friendly' ? 'Just a heads-up: Your ₹1,499 payment didn\'t go through' :
                        'Your ₹1,499 payment didn\'t go through — complete it here'
                      )}
                    </p>
                  </div>

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
                    {emailTone === 'urgent' ? (
                      <p className="text-stone-800 dark:text-stone-200 text-lg font-medium leading-relaxed">
                        <strong className="text-stone-900 dark:text-white">Immediate action required:</strong> Your payment of <strong className="text-stone-900 dark:text-white">₹1,499</strong> failed. To avoid cancellation/interruption, please complete your payment using the link below.
                      </p>
                    ) : emailTone === 'friendly' ? (
                      <p className="text-stone-800 dark:text-stone-200 text-lg font-medium leading-relaxed">
                        Hey! We noticed your <strong className="text-stone-900 dark:text-white">₹1,499</strong> payment didn't quite make it. Don't worry — we've saved your spot. You can finish up below whenever you're ready!
                      </p>
                    ) : (
                      <p className="text-stone-800 dark:text-stone-200 text-lg font-medium leading-relaxed">
                        Your payment of <strong className="text-stone-900 dark:text-white">₹1,499</strong> couldn't be processed, but we've saved your order details.
                      </p>
                    )}
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
