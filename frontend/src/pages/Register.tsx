import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import toast from 'react-hot-toast';
import { ShieldPlus, Mail, Lock, UserPlus, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { AuthUser } from '../App';

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
  const [name, setName] = useState('');
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
      const { data } = await api.post('/auth/register', { name, email, password });
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
              PayRecover
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
              <label htmlFor="reg-name" className="text-xs font-semibold uppercase tracking-wider text-stone-400 ml-1">Full Name</label>
              <div className="relative">
                <ShieldPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" aria-hidden="true" />
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-warm-border dark:border-stone-600 bg-cream dark:bg-stone-700 text-sm font-medium placeholder:text-stone-300 dark:placeholder:text-stone-500 outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-all text-stone-700 dark:text-stone-200"
                  placeholder="Your Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            </div>

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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-border dark:border-stone-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-stone-800 text-stone-400">or</span>
            </div>
          </div>

          <button
            onClick={() => window.location.href = import.meta.env.VITE_API_URL + '/auth/google'}
            className="w-full bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            Continue with Google
          </button>

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
