import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MonitorDetails from './pages/MonitorDetails';
import PublicStatus from './pages/PublicStatus';
import { Moon, Sun, LogOut, ShieldAlert } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { api } from './api';

type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
};

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    // Always ensure correct class on mount and toggle
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
    const logoutId = toast.loading('Terminating session...');
    try {
      await api.post('/auth/logout');
      setUser(null);
      toast.success('Securely logged out', { id: logoutId });
      // Minor delay to ensure state update before hard redirect
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    } catch (err) {
      toast.error('Session clearance failed', { id: logoutId });
      // Hard redirect as fallback
      setUser(null);
      window.location.href = '/login';
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

  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex flex-col transition-colors bg-cream dark:bg-stone-900">
      <header className="sticky top-0 z-50 p-4 border-b border-warm-border dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="bg-stone-700 dark:bg-stone-600 p-2.5 rounded-xl group-hover:bg-stone-600 dark:group-hover:bg-stone-500 transition-colors">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-stone-800 dark:text-stone-100">
              API Pulse
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Signed in as</span>
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{user.email}</span>
              </div>
            )}
            
            <div className="h-4 w-[1px] bg-warm-border dark:bg-stone-700 hidden sm:block" />
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {user && (
                <button 
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium text-sm"
                >
                  <LogOut className="w-4 h-4 mr-1.5 inline-block" />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
      
      <footer className="p-8 border-t border-warm-border dark:border-stone-800 text-center">
        <p className="text-xs font-medium text-stone-400 tracking-wide">
          &copy; 2026 API Pulse
        </p>
      </footer>
    </div>
  );

  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: '!bg-white dark:!bg-stone-800 !text-stone-700 dark:!text-stone-200 !border !border-warm-border dark:!border-stone-700 !px-5 !py-3.5 !rounded-xl !font-medium',
          duration: 4000,
        }} 
      />
      <Routes>
        <Route path="/status" element={<PublicStatus />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        <Route path="/*" element={
          user ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/monitors/:id" element={<MonitorDetails />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Layout>
          ) : <Navigate to="/login" />
        } />
      </Routes>
    </Router>
  );
}

export default App;
