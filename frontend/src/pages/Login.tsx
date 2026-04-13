import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import toast from 'react-hot-toast';
import { ShieldAlert, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import type { AuthUser } from '../App';

interface Props {
  onLoginSuccess: (user: AuthUser) => void;
}

const Login: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.success) {
        toast.success('Signed in successfully');
        onLoginSuccess(data.data.user);
      }
    } catch (err: unknown) {
      const normalized = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = normalized.response?.data?.error || normalized.message || 'Something went wrong.';
      // Show error inline only — a toast on top of the inline banner is redundant noise.
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
            <div className="bg-stone-700 dark:bg-stone-600 p-3.5 rounded-xl shadow-md mb-6">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-800 dark:text-stone-100">
              PayRecover
            </h1>
          </div>

          <h2 className="text-lg font-semibold text-center mb-8 text-stone-600 dark:text-stone-300">Sign In</h2>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl mb-6 flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm font-medium text-red-700 dark:text-red-300 leading-tight">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-stone-400 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" aria-hidden="true" />
                <input
                  id="login-email"
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
              <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-stone-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-warm-border dark:border-stone-600 bg-cream dark:bg-stone-700 text-sm font-medium placeholder:text-stone-300 dark:placeholder:text-stone-500 outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-all text-stone-700 dark:text-stone-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pr-1">
              <Link to="/forgot-password" title="Request Password Reset" className="text-xs font-semibold text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
                Forgot password?
              </Link>
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
                  <LogIn className="w-4 h-4" />
                  Sign In
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
              New here? <Link to="/register" className="text-stone-600 dark:text-stone-300 hover:underline font-semibold ml-1">Create account</Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Login;
