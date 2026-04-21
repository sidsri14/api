import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Zap, FileText, Send, CreditCard, Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../components/common/ThemeToggle';

const FloatingShape = ({ className, delay = 0 }: { className: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ 
      opacity: [0.1, 0.3, 0.1],
      y: [0, -20, 0],
      rotate: [0, 10, 0]
    }}
    transition={{ 
      duration: 10, 
      repeat: Infinity, 
      delay,
      ease: "easeInOut" 
    }}
    className={className}
  />
);

const LandingPage: FC = () => {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);

  return (
    <div className="min-h-screen mesh-bg selection:bg-emerald-100 selection:text-emerald-900 transition-all duration-700 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <FloatingShape className="absolute top-[10%] left-[5%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <FloatingShape className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" delay={2} />
        <FloatingShape className="absolute top-[40%] right-[50%] w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" delay={4} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="bg-slate-900 dark:bg-emerald-600 p-2.5 rounded-2xl group-hover:rotate-12 transition-transform shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white uppercase">StripeFlow</span>
          </motion.div>
          
          <div className="flex items-center gap-4 sm:gap-8">
            <ThemeToggle />
            <button onClick={() => navigate('/login')} className="nav-link hidden md:block">Sign In</button>
            <button onClick={() => navigate('/register')} className="btn-primary !px-6 !py-3">Start Free</button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-44">
        {/* Hero Section */}
        <section className="px-6 relative">
          <div className="max-w-7xl mx-auto text-center space-y-12">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-glow"
            >
              <Sparkles className="w-3.5 h-3.5" /> Premium Invoicing & Recovery Flow
            </motion.div>
            
            <motion.div style={{ y: y1 }}>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl md:text-9xl font-black gradient-heading tracking-tighter leading-[0.85] mb-8"
              >
                PAYMENT <br /> <span className="text-emerald-500 dark:text-emerald-400">EVOLUTION.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="max-w-2xl mx-auto text-slate-500 dark:text-slate-400 text-lg md:text-xl font-medium leading-relaxed"
              >
                The elite invoicing engine for modern professionals. Branded PDFs, high-converting Stripe links, and legendary automated recovery flow.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8"
            >
              <button 
                onClick={() => navigate('/register')} 
                className="btn-primary !px-12 !py-6 !text-[13px] shadow-2xl shadow-emerald-500/20 group hover:scale-105 active:scale-95"
              >
                Initialize Your Engine <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </button>
              <button 
                onClick={() => navigate('/demo?invoice=demo')} 
                className="btn-secondary !px-12 !py-6 !text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
              >
                Live Preview
              </button>
            </motion.div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-44 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: FileText, title: 'Branded PDFs', desc: 'Automatic generation of world-class, premium PDF invoices that speak your brand language.', color: 'emerald' },
                { icon: Send, title: 'Auto-Reminders', desc: 'Intelligent, humane recovery sequences via Resend and WhatsApp. Stop chasing, start receiving.', color: 'blue' },
                { icon: CreditCard, title: 'Instant Stripe', desc: 'Frictionless Stripe Checkout sessions integrated into every invoice for lightning-fast payouts.', color: 'purple' }
              ].map((feat, idx) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-card group"
                >
                  <div className={`w-16 h-16 rounded-[1.5rem] bg-${feat.color}-500/10 flex items-center justify-center border border-${feat.color}-500/20 mb-8 group-hover:rotate-6 transition-all duration-500`}>
                    <feat.icon className={`w-8 h-8 text-${feat.color}-500`} />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight mb-4">{feat.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Tease */}
        <section className="pb-44 px-6 relative">
          <div className="max-w-4xl mx-auto text-center space-y-16">
            <div className="space-y-4">
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter gradient-heading">Symphony of Sales.</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Simple, Sophisticated Pricing</p>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="glass-card hover:scale-100 !p-16 space-y-10 glow-emerald max-w-2xl mx-auto"
            >
              <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                Most Popular
              </div>
              <div className="space-y-2">
                <h3 className="text-4xl font-black">Professional</h3>
                <div className="flex items-center justify-center gap-3">
                   <span className="text-7xl font-black tracking-tighter">₹1499</span>
                   <span className="text-slate-400 font-bold text-sm">/ mo</span>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {[
                  'Unlimited Premium Invoices',
                  'Automated Recovery Sequences',
                  'Custom Brand Experience',
                  'Client Analytics Dashboard',
                  'Priority Support'
                ].map(item => (
                  <div key={item} className="flex items-center gap-4 text-slate-600 dark:text-slate-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> {item}
                  </div>
                ))}
              </div>
              <button 
                onClick={() => navigate('/register')} 
                className="w-full btn-primary !py-6 !text-[13px] justify-center group"
              >
                Access the Engine <Sparkles className="ml-2 w-4 h-4 group-hover:rotate-12 transition-transform" />
              </button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-24 border-t border-slate-100 dark:border-slate-900 px-6 bg-white dark:bg-slate-950/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex items-center gap-3 opacity-50 grayscale hover:grayscale-0 transition-all">
            <div className="bg-slate-900 border border-slate-700 p-2 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white uppercase">StripeFlow</span>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-6">
            <div className="flex gap-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Link to="/terms" className="hover:text-emerald-500 transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-emerald-500 transition-colors">Privacy</Link>
              <Link to="/contact" className="hover:text-emerald-500 transition-colors">Contact</Link>
            </div>
            <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em]">
              &copy; 2026 StripeFlow Core Engine &middot; Premium Recovery Flow
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
