import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, RotateCcw, CheckCircle2, Smartphone } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    timeseries?: Array<{ date: string, failed: number, recovered: number }>;
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
    <>
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
    
    {stats?.timeseries && stats.timeseries.length > 0 && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 p-6 rounded-2xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm"
      >
        <h3 className="text-sm font-black uppercase tracking-widest text-stone-800 dark:text-stone-100 mb-6">Revenue Recovery (30 Days)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} dy={10} minTickGap={20} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} tickFormatter={(val) => `₹${val/100}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#18181b', marginBottom: '4px' }}
                formatter={(value: any, name: any) => [`₹${(Number(value)/100).toFixed(2)}`, name === 'recovered' ? 'Recovered' : 'Failed']}
              />
              <Area type="monotone" dataKey="failed" stroke="#f87171" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" />
              <Area type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    )}
    </>
  );
};
