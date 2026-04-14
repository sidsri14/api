import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, RotateCcw, CheckCircle2, Smartphone } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DashboardStatsProps {
  stats: {
    totalFailed: number;
    totalRecovered: number;
    recoveryRate: number;
    totalFailedAmount: number;
    totalRecoveredAmount: number;
    totalClicks: number;
    platformBreakdown?: { mobile: number; desktop: number };
  } | null;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  const cards = [
    {
      label: 'Recovery Rate',
      value: `${stats?.recoveryRate ?? 0}%`,
      sub: 'Of all failed payments',
      icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
      color: 'emerald',
    },
    {
      label: 'Link Interactions',
      value: stats?.totalClicks ?? 0,
      sub: 'Total Click Volume',
      icon: <RotateCcw className="w-5 h-5 text-blue-500" />,
      color: 'blue',
    },
    {
      label: 'Mobile Clicks',
      value: stats?.platformBreakdown?.mobile ?? 0,
      sub: 'User-Agent identified',
      icon: <Smartphone className="w-5 h-5 text-indigo-500" />,
      color: 'indigo',
    },
    {
      label: 'Total Recovered',
      value: stats?.totalRecovered ?? 0,
      sub: 'Success Count',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      color: 'emerald',
    },
    {
      label: 'Active Retries',
      value: stats?.totalFailed ?? 0,
      sub: 'In recovery queue',
      icon: <RotateCcw className="w-5 h-5 text-amber-500" />,
      color: 'amber',
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, idx) => (
        <motion.div
           key={card.label}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: idx * 0.05 }}
           className="p-5 rounded-2xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover:text-stone-500 transition-colors">
              {card.label}
            </p>
            <div className={cn(
              "p-2 rounded-xl shrink-0 transition-all",
              card.color === 'emerald' ? "bg-emerald-50 dark:bg-emerald-900/20 group-hover:bg-emerald-100" :
              card.color === 'blue' ? "bg-blue-50 dark:bg-blue-900/20 group-hover:bg-blue-100" :
              card.color === 'indigo' ? "bg-indigo-50 dark:bg-indigo-900/20 group-hover:bg-indigo-100" :
              "bg-amber-50 dark:bg-amber-900/20 group-hover:bg-amber-100"
            )}>
              {card.icon}
            </div>
          </div>
          <h4 className="text-2xl font-black text-stone-800 dark:text-stone-100 mb-0.5 tracking-tight">
            {card.value}
          </h4>
          <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
            {card.sub}
          </p>
        </motion.div>
      ))}
    </div>
  );
};
