import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import { Moon, Sun, LogOut, TrendingUp, Link2, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { api } from './api';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PaymentDetails = lazy(() => import('./pages/PaymentDetails'));
const Sources = lazy(() => import('./pages/Sources'));
const Settings = lazy(() => import('./pages/Settings'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'starter' | 'pro';
  createdAt: string;
};

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin opacity-50" />
  </div>
);

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-warm-border dark:border-stone-700"
      title="Toggle Theme"
    >
      {isDark ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-stone-500" />}
    </button>
  );
};

type LayoutProps = {
  user: AuthUser;
  onLogout: () => void;
};

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  return (
  <div className="min-h-screen flex flex-col transition-colors bg-cream dark:bg-stone-900">
    <header className="sticky top-0 z-50 p-4 border-b border-warm-border dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-emerald-600 dark:bg-emerald-700 p-2.5 rounded-xl group-hover:bg-emerald-500 dark:group-hover:bg-emerald-600 transition-colors">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-stone-800 dark:text-stone-100">
            PayRecover
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sources')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm border border-transparent hover:border-warm-border dark:hover:border-stone-700"
          >
            <Link2 className="w-4 h-4" /> Sources
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm border border-transparent hover:border-warm-border dark:hover:border-stone-700"
          >
            <SettingsIcon className="w-4 h-4" /> Settings
          </button>

          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Signed in as</span>
            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{user.name || user.email}</span>
          </div>

          <div className="h-4 w-[1px] bg-warm-border dark:bg-stone-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm"
            >
              <LogOut className="w-4 h-4 mr-1.5 inline-block" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>

    <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
      {children}
    </main>

    <footer className="p-8 border-t border-warm-border dark:border-stone-800 text-center">
      <p className="text-xs font-medium text-stone-400 tracking-wide">
        &copy; 2026 PayRecover
      </p>
    </footer>
  </div>
  );
};

// ── Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-cream dark:bg-stone-900">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100">Something went wrong.</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm">We've encountered an unexpected error.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageTitle() {
  const location = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'PayRecover | Failed Payment Recovery',
      '/dashboard': 'Dashboard | PayRecover',
      '/login': 'Sign In | PayRecover',
      '/register': 'Create Account | PayRecover',
      '/sources': 'Payment Sources | PayRecover',
      '/settings': 'Settings | PayRecover',
      '/forgot-password': 'Reset Password | PayRecover',
      '/reset-password': 'New Password | PayRecover',
      '/verify-email': 'Verify Account | PayRecover',
    };
    document.title = titles[location.pathname] || 'PayRecover | Failed Payment Recovery';
  }, [location.pathname]);
  return null;
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data.success) {
        setUser(data.data);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    const logoutId = toast.loading('Signing out...');
    try {
      await api.post('/auth/logout');
      toast.success('Signed out', { id: logoutId });
    } catch {
      toast.dismiss(logoutId);
    } finally {
      setUser(null);
      // Immediately rotate CSRF token after logout to prevent stale submissions on next login
      api.get('/api/csrf-token').catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-stone-900 transition-colors">
        <div className="flex flex-col items-center gap-6">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-stone-300 dark:border-stone-600"></div>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <PageTitle />
        <Toaster
          position="top-right"
          toastOptions={{
            className: '!bg-white dark:!bg-stone-800 !text-stone-700 dark:!text-stone-200 !border !border-warm-border dark:!border-stone-700 !px-5 !py-3.5 !rounded-xl !font-medium',
            duration: 4000,
          }}
        />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLoginSuccess={(u) => setUser(u)} />} />
            <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register onRegisterSuccess={(u) => setUser(u)} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Protected Routes */}
            <Route path="/*" element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/payments/:id" element={<PaymentDetails />} />
                    <Route path="/sources" element={<Sources />} />
                    <Route path="/settings" element={<Settings user={user} onUpdateUser={(u) => setUser(u)} />} />
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </Layout>
              ) : <Navigate to="/login" />
            } />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
