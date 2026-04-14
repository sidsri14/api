import React, { useState, useEffect, Suspense, lazy } from 'react';
import ErrorBoundary from './components/common/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';

import { Moon, Sun, LogOut, TrendingUp, Link2, Loader2, Settings as SettingsIcon, Menu, X, Users, Webhook, KeyRound } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { api } from './api';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PaymentDetails = lazy(() => import('./pages/PaymentDetails'));
const Sources = lazy(() => import('./pages/Sources'));
const Settings = lazy(() => import('./pages/Settings'));
const Branding = lazy(() => import('./pages/Branding'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const PaymentStatus = lazy(() => import('./pages/PaymentStatus'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Contact = lazy(() => import('./pages/Contact'));
const Team = lazy(() => import('./pages/Team'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const ApiKeys = lazy(() => import('./pages/ApiKeys'));

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'starter' | 'pro';
  createdAt: string;
  hasPassword: boolean;
  googleLinked: boolean;
  brandSettings?: string | null;
  brandEmailSubject?: string | null;
  brandEmailTone?: string | null;
};

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin opacity-50" />
  </div>
);

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
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

const MobileNav = ({ user, onLogout }: { user: AuthUser; onLogout: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { label: 'Dashboard', icon: TrendingUp, path: '/dashboard' },
    { label: 'Sources', icon: Link2, path: '/sources' },
    { label: 'Team', icon: Users, path: '/team' },
    { label: 'Webhooks', icon: Webhook, path: '/webhooks' },
    { label: 'API Keys', icon: KeyRound, path: '/api-keys' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400"
      >
        <Menu className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200">
          <div className="fixed inset-y-0 right-0 w-72 bg-white dark:bg-stone-900 shadow-2xl border-l border-warm-border dark:border-stone-800 p-6 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Account</span>
                <span className="text-sm font-bold text-stone-800 dark:text-stone-100 truncate max-w-[180px]">
                   {user.name || user.email}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 w-full p-4 rounded-2xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all text-stone-600 dark:text-stone-300 font-bold text-sm text-left"
                >
                  <item.icon className="w-5 h-5 text-emerald-500" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="pt-6 border-t border-warm-border dark:border-stone-800">
              <button
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 font-bold text-sm transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
          <div className="bg-emerald-600 dark:bg-emerald-700 p-2.5 rounded-xl group-hover:bg-emerald-500 dark:group-hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-stone-800 dark:text-stone-100 hidden sm:block">
            PayRecover
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="hidden md:flex items-center gap-4">
            <button
              onClick={() => navigate('/sources')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm border border-transparent hover:border-warm-border dark:hover:border-stone-700"
            >
              <Link2 className="w-4 h-4" /> Sources
            </button>

            <button
              onClick={() => navigate('/team')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm border border-transparent hover:border-warm-border dark:hover:border-stone-700"
            >
              <Users className="w-4 h-4" /> Team
            </button>

            <button
              onClick={() => navigate('/webhooks')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm border border-transparent hover:border-warm-border dark:hover:border-stone-700"
            >
              <Webhook className="w-4 h-4" /> Webhooks
            </button>

            <button
              onClick={() => navigate('/api-keys')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm border border-transparent hover:border-warm-border dark:hover:border-stone-700"
            >
              <KeyRound className="w-4 h-4" /> API Keys
            </button>

            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm border border-transparent hover:border-warm-border dark:hover:border-stone-700"
            >
              <SettingsIcon className="w-4 h-4" /> Settings
            </button>
          </nav>

          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Signed in as</span>
            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{user.name || user.email}</span>
          </div>

          <div className="h-4 w-[1px] bg-warm-border dark:bg-stone-700 hidden md:block" />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="md:hidden">
              <MobileNav user={user} onLogout={onLogout} />
            </div>
            <button
              onClick={onLogout}
              className="hidden sm:flex px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm"
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

    <footer className="p-8 border-t border-warm-border dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full">
      <p className="text-xs font-medium text-stone-400 tracking-wide">
        &copy; 2026 PayRecover
      </p>
      <div className="flex gap-6 text-xs font-medium text-stone-400">
        <Link to="/terms" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Terms</Link>
        <Link to="/privacy" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Privacy</Link>
        <Link to="/contact" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Contact</Link>
      </div>
    </footer>
  </div>
  );
};



function PageTitle() {
  const location = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'PayRecover | Failed Payment Recovery',
      '/dashboard': 'Dashboard | PayRecover',
      '/login': 'Sign In | PayRecover',
      '/register': 'Create Account | PayRecover',
      '/sources': 'Payment Sources | PayRecover',
      '/team': 'Team Management | PayRecover',
      '/settings': 'Settings | PayRecover',
      '/branding': 'Branding & Design | PayRecover',
      '/webhooks': 'Webhooks | PayRecover',
      '/api-keys': 'API Keys | PayRecover',
      '/forgot-password': 'Reset Password | PayRecover',
      '/reset-password': 'New Password | PayRecover',
      '/verify-email': 'Verify Account | PayRecover',
      '/payment-status': 'Payment Status | PayRecover',
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
            <Route path="/payment-status" element={<PaymentStatus />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contact" element={<Contact />} />

            {/* Protected Routes */}
            <Route path="/*" element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard user={user} />} />
                    <Route path="/payments/:id" element={<PaymentDetails />} />
                    <Route path="/sources" element={<Sources />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/settings" element={<Settings user={user} onUpdateUser={(u) => setUser(u)} />} />
                    <Route path="/branding" element={<Branding user={user} onUpdateUser={(u) => setUser(u)} />} />
                    <Route path="/webhooks" element={<Webhooks />} />
                    <Route path="/api-keys" element={<ApiKeys />} />
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
