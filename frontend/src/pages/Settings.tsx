import { useState, useRef, useEffect } from 'react';
import type { FC, FormEvent } from 'react';
import { Shield, CreditCard, Check, Zap, User, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import type { AuthUser } from '../App';

interface Props {
  user: AuthUser;
  onUpdateUser: (user: AuthUser) => void;
}

const Settings: FC<Props> = ({ user, onUpdateUser }) => {
  const [loading, setLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user.name || '', email: user.email });
  const [securityForm, setSecurityForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const rzpRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      rzpRef.current?.close();
    };
  }, []);

  const handleUpdatePlan = async (plan: 'free' | 'pro') => {
    setLoading(true);
    try {
      const { data } = await api.patch('/billing/plan', { plan });
      if (data.success) {
        toast.success(`Plan updated to ${plan === 'free' ? 'Free' : 'Pro'}`);
        onUpdateUser(data.data.user);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to update plan');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToPro = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/billing/create-subscription', { plan: 'pro' });
      if (!data.success) throw new Error(data.error || 'Failed to create subscription');

      const { subscriptionId, shortUrl: _shortUrl } = data.data;

      // Open Razorpay checkout modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
        subscription_id: subscriptionId,
        name: 'PayRecover',
        description: 'Pro Recovery Plan — ₹1,499/mo',
        handler: (_response: any) => {
          rzpRef.current = null;
          setLoading(false);
          toast.success('Subscription activated! Your plan will update shortly.');
          // Re-fetch user after a short delay to pick up the webhook-updated plan
          setTimeout(() => window.location.reload(), 2000);
        },
        prefill: {
          email: user.email,
          name: user.name || '',
        },
        theme: { color: '#059669' },
        modal: {
          ondismiss: () => {
            if (rzpRef.current) {
              toast('Checkout closed.', { icon: 'ℹ️' });
              setLoading(false);
            }
            rzpRef.current = null;
          },
        },
      };

      rzpRef.current = new (window as any).Razorpay(options);
      rzpRef.current.open();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to start checkout');
      setLoading(false);
    }
    // Note: setLoading(false) is handled by modal dismiss or page reload on success
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const { data } = await api.patch('/auth/profile', profileForm);
      if (data.success) {
        toast.success('Profile updated successfully');
        onUpdateUser(data.data.user);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    setSecurityLoading(true);
    try {
      const { data } = await api.patch('/auth/password', {
        oldPassword: securityForm.oldPassword,
        newPassword: securityForm.newPassword
      });
      if (data.success) {
        toast.success('Password updated successfully');
        setSecurityForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to update password');
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-16 pb-20"
    >
      <header>
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">
          Settings
        </h1>
        <p className="text-stone-400 mt-1 font-medium text-xs tracking-wide">
          Manage your account, billing, and system preferences
        </p>
      </header>

      {/* Subscription & Billing */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-warm-border dark:border-stone-800 pb-4">
          <CreditCard className="w-5 h-5 text-stone-400" />
          <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Subscription & Billing</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 rounded-2xl border transition-all ${user.plan === 'free' ? 'border-emerald-500 bg-white dark:bg-stone-800 shadow-soft' : 'border-warm-border dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-stone-800 dark:text-stone-100 italic">Free Tier</h3>
                <p className="text-2xl font-black text-stone-900 dark:text-white mt-1">₹0<span className="text-sm font-medium text-stone-400">/mo</span></p>
              </div>
              {user.plan === 'free' && (
                <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-md border border-emerald-200 dark:border-emerald-800">Current Plan</span>
              )}
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400"><Check className="w-4 h-4 text-emerald-500" /> Failed payment monitoring</li>
              <li className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400"><Check className="w-4 h-4 text-emerald-500" /> Dashboard analytics</li>
              <li className="flex items-center gap-2 text-sm text-stone-400 line-through opacity-50">Automated email recovery</li>
            </ul>
            {user.plan !== 'free' && (
                <button onClick={() => handleUpdatePlan('free')} disabled={loading} className="w-full py-2.5 rounded-xl border border-warm-border dark:border-stone-700 text-stone-600 dark:text-stone-400 font-semibold text-sm hover:bg-white dark:hover:bg-stone-800 transition-all opacity-60 hover:opacity-100">
                  Downgrade
                </button>
            )}
          </div>

          <div className={`p-6 rounded-2xl border transition-all ${user.plan !== 'free' ? 'border-emerald-500 bg-white dark:bg-stone-800 shadow-soft' : 'border-emerald-600/30 bg-emerald-50/10 dark:bg-emerald-900/5 shadow-soft'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-bold text-emerald-600 dark:text-emerald-400 italic">Pro Recovery</h3><Zap className="w-3 h-3 text-amber-400 fill-amber-400" /></div>
                <p className="text-2xl font-black text-stone-900 dark:text-white mt-1">₹1,499<span className="text-sm font-medium text-stone-400">/mo</span></p>
              </div>
              {user.plan !== 'free' ? (
                <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-md border border-emerald-200 dark:border-emerald-800">Current Plan</span>
              ) : (
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase rounded-md border border-amber-200 dark:border-amber-800 animate-pulse">Unlock Worker</span>
              )}
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 font-medium"><Check className="w-4 h-4 text-emerald-500" /> Automated recovery worker</li>
              <li className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 font-medium"><Check className="w-4 h-4 text-emerald-500" /> High-conversion email templates</li>
              <li className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 font-medium"><Check className="w-4 h-4 text-emerald-500" /> Custom branding (coming soon)</li>
            </ul>
            {user.plan === 'free' ? (
              <button onClick={handleUpgradeToPro} disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Upgrade to Pro</>}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <Check className="w-4 h-4" /> Active & Running
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Profile Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-warm-border dark:border-stone-800 pb-4">
          <User className="w-5 h-5 text-stone-400" />
          <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Profile Settings</h2>
        </div>
        
        <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 rounded-2xl p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Full Name</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Satish Chandra"
                className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none focus:border-stone-200 dark:focus:border-stone-500 text-stone-700 dark:text-stone-200 transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Email Address</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none text-stone-400 dark:text-stone-500 cursor-not-allowed"
                disabled
              />
              <p className="text-[10px] text-stone-400 pl-1">Email cannot be changed yet.</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={profileLoading}
              className="px-8 py-3 bg-stone-800 dark:bg-emerald-600 hover:bg-stone-700 dark:hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-xl shadow-stone-500/10 flex items-center gap-2"
            >
              {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Security */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-warm-border dark:border-stone-800 pb-4">
          <Shield className="w-5 h-5 text-stone-400" />
          <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Security</h2>
        </div>

        <form onSubmit={handleUpdatePassword} className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 rounded-2xl p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Current Password</label>
              <input
                type="password"
                value={securityForm.oldPassword}
                onChange={e => setSecurityForm(f => ({ ...f, oldPassword: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none focus:border-stone-200 dark:focus:border-stone-500 text-stone-700 dark:text-stone-200 transition-colors"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">New Password</label>
                <input
                  type="password"
                  value={securityForm.newPassword}
                  onChange={e => setSecurityForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none focus:border-stone-200 dark:focus:border-stone-500 text-stone-700 dark:text-stone-200 transition-colors"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Confirm New Password</label>
                <input
                  type="password"
                  value={securityForm.confirmPassword}
                  onChange={e => setSecurityForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none focus:border-stone-200 dark:focus:border-stone-500 text-stone-700 dark:text-stone-200 transition-colors"
                  required
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={securityLoading}
              className="px-8 py-3 bg-stone-800 dark:bg-emerald-600 hover:bg-stone-700 dark:hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-xl shadow-stone-500/10 flex items-center gap-2"
            >
              {securityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      <div className="pt-8 border-t border-warm-border dark:border-stone-800">
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center">User ID: {user.id} · Joined {new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
      </div>
    </motion.div>
  );
};

export default Settings;
