import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import toast from 'react-hot-toast';
import { ShieldPlus, Mail, Lock, UserPlus, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

type AuthUser = { id: string; email: string; createdAt: string };

interface Props {
  onRegisterSuccess: (user: AuthUser) => void;
}

// Password requirement rules shown in the UI — must stay in sync with backend registerSchema
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const Register: React.FC<Props> = ({ onRegisterSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const allRulesMet = PASSWORD_RULES.every(r => r.test(password));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allRulesMet) {
      setPasswordTouched(true);
      setError('Please satisfy all password requirements.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', { email, password });
      if (data.success) {
        toast.success('Account created — welcome!');
        // The backend sets an httpOnly auth cookie on registration.
        // Calling onRegisterSuccess with the user data logs the user in immediately
        // without forcing them to sign in again.
        onRegisterSuccess(data.data.user);
      }
    } catch (err: unknown) {
      const normalized = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = normalized.response?.data?.error || normalized.message || 'Something went wrong';
      // Show error inline only — no duplicate toast.
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream dark:bg-stone-900 transition-colors">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 rounded-2xl p-10 shadow-card">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-stone-700 dark:bg-stone-600 p-4 rounded-xl shadow-md mb-6">
              <ShieldPlus className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-800 dark:text-stone-100">
              RecoverPay
            </h1>
          </div>

          <p className="text-center text-stone-400 mb-8 font-medium text-sm">
            Create your account to get started.
          </p>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl mb-6 flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm font-medium text-red-700 dark:text-red-300 leading-tight">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="text-xs font-semibold uppercase tracking-wider text-stone-400 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" aria-hidden="true" />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-warm-border dark:border-stone-600 bg-cream dark:bg-stone-700 text-sm font-medium placeholder:text-stone-300 dark:placeholder:text-stone-500 outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-all text-stone-700 dark:text-stone-200"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wider text-stone-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" aria-hidden="true" />
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-warm-border dark:border-stone-600 bg-cream dark:bg-stone-700 text-sm font-medium placeholder:text-stone-300 dark:placeholder:text-stone-500 outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-all text-stone-700 dark:text-stone-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  required
                />
              </div>

              {/* Password strength checklist — only shown after first interaction */}
              {(passwordTouched || password.length > 0) && (
                <ul className="mt-2 space-y-1 px-1">
                  {PASSWORD_RULES.map(rule => {
                    const passed = rule.test(password);
                    return (
                      <li key={rule.label} className={`flex items-center gap-2 text-xs font-medium transition-colors ${passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                        {passed
                          ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          : <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-stone-700 hover:bg-stone-600 dark:bg-stone-600 dark:hover:bg-stone-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-b-2 border-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <footer className="mt-8 text-center border-t border-warm-border dark:border-stone-700 pt-6">
            <p className="text-sm text-stone-400">
              Have an account? <Link to="/login" className="text-stone-600 dark:text-stone-300 hover:underline font-semibold ml-1">Sign In</Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Register;
