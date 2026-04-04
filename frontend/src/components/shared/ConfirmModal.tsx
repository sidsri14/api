import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="relative w-full max-w-sm glass rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-stone-900 border border-warm-border dark:border-stone-800"
          >
            <div className="p-8 space-y-6">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner",
                isDestructive ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
              )}>
                <AlertTriangle className="w-7 h-7" />
              </div>
              
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-black text-stone-800 dark:text-stone-100 tracking-tight">
                  {title}
                </h3>
                <p className="text-sm font-medium text-stone-500 dark:text-stone-400 leading-relaxed px-2">
                  {message}
                </p>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 border border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className={cn(
                    "flex-1 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2",
                    isDestructive 
                      ? "bg-red-600 hover:bg-red-500 shadow-xl shadow-red-600/30" 
                      : "bg-stone-800 hover:bg-stone-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-xl shadow-emerald-600/30"
                  )}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-white/50" /> : confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
