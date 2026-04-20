import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, RotateCcw, CheckCircle2, Smartphone, Monitor, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
      label: 'Paid Revenue',
      value: `$${(stats?.totalRecoveredAmount ?? 0) / 100}`,
      sub: 'Successfully collected',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      color: 'emerald',
    },
    {
      label: 'Pending Invoices',
      value: stats?.totalFailed ?? 0,
      sub: 'Awaiting payment',
      icon: <RotateCcw className="w-5 h-5 text-blue-500" />,
      color: 'blue',
    },
    {
      label: 'Overdue Count',
      value: stats?.totalClicks ?? 0, // Reuse placeholder or update Backend
      sub: 'Requires attention',
      icon: <AlertTriangle className="w-5 h-5 text-rose-500" />,
      color: 'rose',
    },
    {
      label: 'Total Invoiced',
      value: `$${(stats?.totalFailedAmount ?? 0) / 100}`,
      sub: 'Lifetime volume',
      icon: <TrendingUp className="w-5 h-5 text-indigo-500" />,
      color: 'indigo',
    },
    {
      label: 'Recovery Rate',
      value: `${stats?.recoveryRate ?? 0}%`,
      sub: 'Success percentage',
      icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
      color: 'emerald',
    }
  ];

  const platformData = [
    { name: 'Mobile', value: stats?.platformBreakdown?.mobile ?? 0 },
    { name: 'Desktop', value: stats?.platformBreakdown?.desktop ?? 0 },
  ].filter(d => d.value > 0);

  const COLORS = ['#6366f1', '#10b981'];

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
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      {/* Revenue Trends */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-2 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-stone-800 dark:text-stone-100">Revenue Recovery (30 Days)</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-emerald-500" />
               <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Recovered</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-rose-400" />
               <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Unrecovered</span>
            </div>
          </div>
        </div>
        
        <div className="h-72 w-full">
          {stats?.timeseries && stats.timeseries.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#a1a1aa', fontWeight: 600 }} dy={10} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#a1a1aa', fontWeight: 600 }} tickFormatter={(val) => `₹${val/100}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', backgroundColor: '#fff' }}
                  labelStyle={{ fontWeight: '800', color: '#18181b', marginBottom: '8px', fontSize: '12px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: '600' }}
                  formatter={(value: any, name: any) => [`₹${(Number(value)/100).toFixed(2)}`, name === 'recovered' ? 'Recovered' : 'Failed']}
                />
                <Area type="monotone" dataKey="failed" stroke="#f87171" strokeWidth={3} fillOpacity={1} fill="url(#colorFailed)" />
                <Area type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-stone-300 gap-2">
               <TrendingUp className="w-10 h-10 opacity-20" />
               <p className="text-[10px] font-black uppercase tracking-widest">Not enough data to show trends</p>
             </div>
          )}
        </div>
      </motion.div>

      {/* Platform Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-3xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm"
      >
        <h3 className="text-sm font-black uppercase tracking-widest text-stone-800 dark:text-stone-100 mb-8">Platform Usage</h3>
        
        <div className="h-48 w-full relative">
          {platformData.length > 0 ? (
            <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  cornerRadius={4}
                  dataKey="value"
                >
                  {platformData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-stone-800 dark:text-stone-100">{stats?.totalClicks ?? 0}</span>
              <span className="text-[8px] font-bold text-stone-400 uppercase tracking-tighter">Clicks</span>
            </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-stone-300 gap-2">
               <Smartphone className="w-10 h-10 opacity-20" />
               <p className="text-[10px] font-black uppercase tracking-widest">No click data</p>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-3">
          <div className="flex justify-between items-center p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Mobile</span>
            </div>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{stats?.platformBreakdown?.mobile ?? 0}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Desktop</span>
            </div>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{stats?.platformBreakdown?.desktop ?? 0}</span>
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
};
