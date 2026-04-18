import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-stone-900 p-6">
          <div className="w-full max-w-md bg-white dark:bg-stone-800 rounded-3xl border border-rose-100 dark:border-rose-900/30 p-8 text-center space-y-6 shadow-xl shadow-rose-200/20 dark:shadow-none">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-900/20 text-rose-500">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-stone-800 dark:text-stone-100 tracking-tight">
                Something went wrong
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-sm font-medium leading-relaxed">
                An unexpected error occurred. We've been notified and are working on it.
              </p>
            </div>
            
            {import.meta.env.MODE === 'development' && this.state.error && (
              <div className="text-left bg-stone-50 dark:bg-stone-900/50 p-4 rounded-xl border border-stone-100 dark:border-stone-700">
                <p className="text-xs font-mono text-rose-600 dark:text-rose-400 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-stone-200 dark:shadow-none"
            >
              <RotateCcw className="w-4 h-4" /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
