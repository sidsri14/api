import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, CreditCard, Check, Zap, User, Loader2, Link2, Palette, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, API_URL } from '../api';
import toast from 'react-hot-toast';
import type { AuthUser } from '../App';

interface Props {
  user: AuthUser;
  onUpdateUser: (user: AuthUser) => void;
}

const Settings: FC<Props> = ({ user, onUpdateUser }) => {
  const [loading, setLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({ 
    name: user.name || '', 
    email: user.email,
    companyName: JSON.parse(user.brandSettings || '{}').companyName || ''
  });
  const [securityForm, setSecurityForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [setPassForm, setSetPassForm] = useState({ password: '', confirmPassword: '' });
  const [setPassLoading, setSetPassLoading] = useState(false);

  const { data: billingData } = useQuery({
    queryKey: ['billing-current'],
    queryFn: async () => {
      const { data } = await api.get('/billing/current');
      return data.data as {
        plan: string;
        subscription: {
          id: string;
          provider: string;
          providerSubscriptionId: string;
          plan: string;
          status: string;
          currentPeriodEnd: string | null;
          cancelledAt: string | null;
        } | null;
      };
    },
    staleTime: 60_000,
  });

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

  const handleCheckout = async (plan: 'starter' | 'pro', gateway: 'stripe' | 'razorpay' = 'stripe') => {
    setLoading(true);
    try {
      const { data } = await api.post('/billing/create-subscription', { plan, gateway });
      if (data.success && data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        toast.error('Failed to initiate checkout link');
        setLoading(false);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to initiate checkout');
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const brandSettings = JSON.parse(user.brandSettings || '{}');
      brandSettings.companyName = profileForm.companyName;
      
      const { data } = await api.patch('/auth/profile', {
        name: profileForm.name,
        brandSettings: JSON.stringify(brandSettings)
      });
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

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (setPassForm.password !== setPassForm.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setSetPassLoading(true);
    try {
      const { data } = await api.patch('/auth/set-password', { password: setPassForm.password });
      if (data.success) {
        toast.success('Password set successfully');
        setSetPassForm({ password: '', confirmPassword: '' });
        onUpdateUser({ ...user, hasPassword: true });
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to set password');
    } finally {
      setSetPassLoading(false);
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
                <p className="text-2xl font-black text-stone-900 dark:text-white mt-1">$0<span className="text-sm font-medium text-stone-400">/mo</span></p>
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
                <div className="flex items-center gap-2"><h3 className="font-bold text-emerald-600 dark:text-emerald-400 italic">Pro Invoicing</h3><Zap className="w-3 h-3 text-amber-400 fill-amber-400" /></div>
                <p className="text-2xl font-black text-stone-900 dark:text-white mt-1">$19<span className="text-sm font-medium text-stone-400">/mo</span></p>
              </div>
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase rounded-md border border-amber-200 dark:border-amber-800 animate-pulse">Unlock Pro</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 font-medium"><Check className="w-4 h-4 text-emerald-500" /> Unlimited Invoices</li>
              <li className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 font-medium"><Check className="w-4 h-4 text-emerald-500" /> Automated Payment Reminders</li>
              <li className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 font-medium"><Check className="w-4 h-4 text-emerald-500" /> Branded PDF Generation</li>
            </ul>
            {user.plan === 'free' ? (
              <button onClick={() => handleCheckout('pro')} disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Upgrade to Pro</>}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <Check className="w-4 h-4" /> Active & Running
              </div>
            )}
          </div>
        </div>

        {billingData?.subscription && (
          <div className="bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <Calendar className="w-5 h-5 text-stone-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200 capitalize">
                {billingData.subscription.plan} plan · via {billingData.subscription.provider}
              </p>
              <p className="text-xs text-stone-400 mt-0.5 font-mono truncate">
                {billingData.subscription.providerSubscriptionId}
              </p>
            </div>
            <div className="text-right shrink-0">
              {billingData.subscription.currentPeriodEnd ? (
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                  Renews {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              ) : billingData.subscription.cancelledAt ? (
                <p className="text-sm font-semibold text-rose-500">
                  Cancelled {new Date(billingData.subscription.cancelledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              ) : null}
              <p className="text-xs text-stone-400 uppercase tracking-wide mt-0.5">{billingData.subscription.status}</p>
            </div>
          </div>
        )}
      </section>

      {/* Branding & Design */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-warm-border dark:border-stone-800 pb-4">
          <Palette className="w-5 h-5 text-stone-400" />
          <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Communication & Branding</h2>
        </div>

        <div className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-xl transition-all group">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Palette className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">Custom Branding</h3>
              <p className="text-stone-400 text-sm font-medium mt-1">
                Customize colors, logos, and signatures for your recovery emails.
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/branding')}
            className="w-full md:w-auto px-8 py-3.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold rounded-2xl text-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            Configure Branding
          </button>
        </div>
      </section>
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
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Company Name</label>
              <input
                type="text"
                value={profileForm.companyName || ''}
                onChange={e => setProfileForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="Ex: ACME Design Studio"
                className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none focus:border-stone-200 dark:focus:border-stone-500 text-stone-700 dark:text-stone-200 transition-colors"
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

        {user.hasPassword ? (
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
        ) : (
          <form onSubmit={handleSetPassword} className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 rounded-2xl p-8 space-y-6">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              You signed up with Google. Set a password to also be able to sign in with email.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">New Password</label>
                <input
                  type="password"
                  value={setPassForm.password}
                  onChange={e => setSetPassForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none focus:border-stone-200 dark:focus:border-stone-500 text-stone-700 dark:text-stone-200 transition-colors"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Confirm Password</label>
                <input
                  type="password"
                  value={setPassForm.confirmPassword}
                  onChange={e => setSetPassForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 outline-none focus:border-stone-200 dark:focus:border-stone-500 text-stone-700 dark:text-stone-200 transition-colors"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={setPassLoading}
                className="px-8 py-3 bg-stone-800 dark:bg-emerald-600 hover:bg-stone-700 dark:hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-xl shadow-stone-500/10 flex items-center gap-2"
              >
                {setPassLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set Password'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Connected Accounts */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-warm-border dark:border-stone-800 pb-4">
          <Link2 className="w-5 h-5 text-stone-400" />
          <h2 className="text-lg font-bold text-stone-700 dark:text-stone-200">Connected Accounts</h2>
        </div>

        <div className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="none" d="M1 1h22v22H1z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-stone-700 dark:text-stone-200">Google</p>
              <p className="text-xs text-stone-400">
                {user.googleLinked ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>

          {user.googleLinked ? (
            <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Connected
            </span>
          ) : (
            <button
              onClick={() => { window.location.href = API_URL + '/auth/google'; }}
              className="px-4 py-2 bg-white dark:bg-stone-700 border border-warm-border dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 font-semibold text-sm rounded-xl transition-all flex items-center gap-2"
            >
              Link Google Account
            </button>
          )}
        </div>
      </section>

      <div className="pt-8 border-t border-warm-border dark:border-stone-800">
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center">User ID: {user.id} · Joined {new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
      </div>
    </motion.div>
  );
};

export default Settings;
