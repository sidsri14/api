import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Zap, FileText, Send, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

const LandingPage: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-cream/80 backdrop-blur-md border-b border-warm-border/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-stone-900 p-2 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tighter text-stone-900 uppercase">StripeFlow</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/login')} className="text-sm font-bold text-stone-500 hover:text-stone-900 transition-colors">Sign In</button>
            <button onClick={() => navigate('/register')} className="px-5 py-2.5 bg-stone-900 text-white text-sm font-bold rounded-xl hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10">Start Free</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest"
          >
            <Zap className="w-3 h-3" /> Branded Invoicing & Automatic Recovery
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-black text-stone-900 tracking-tighter leading-[0.9]"
          >
            GET PAID <br /> <span className="text-emerald-500">EFFORTLESSLY.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto text-stone-500 text-lg md:text-xl font-medium"
          >
            The premium invoicing engine for freelancers. Branded PDFs, Stripe Checkout links, and automated payment reminders — all in one flow.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <button onClick={() => navigate('/register')} className="px-10 py-5 bg-stone-900 text-white font-black text-lg rounded-2xl hover:bg-stone-800 transition-all shadow-2xl shadow-stone-900/20 group">
              Start Your First Flow <ArrowRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => navigate('/demo?invoice=demo')} className="px-10 py-5 bg-white border border-warm-border text-stone-800 font-black text-lg rounded-2xl hover:bg-stone-50 transition-all">
              Live Preview
            </button>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-white/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center border border-warm-border">
                <FileText className="w-7 h-7 text-stone-800" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">Branded PDFs</h3>
              <p className="text-stone-500 leading-relaxed font-medium">Automatic generation of premium, high-converting PDF invoices tailored to your brand.</p>
            </div>
            <div className="space-y-4">
              <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center border border-warm-border">
                <Send className="w-7 h-7 text-stone-800" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">Auto-Reminders</h3>
              <p className="text-stone-500 leading-relaxed font-medium">We schedule intelligent email follow-ups via Resend so you never have to chase a client again.</p>
            </div>
            <div className="space-y-4">
              <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center border border-warm-border">
                <CreditCard className="w-7 h-7 text-stone-800" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">Stripe Checkout</h3>
              <p className="text-stone-500 leading-relaxed font-medium">One-click payment sessions that make it friction-less for your clients to pay you instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Pricing Tease */}
      <section className="py-24 px-6 border-t border-warm-border">
        <div className="max-w-3xl mx-auto text-center space-y-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">Simple, Transparent Pricing.</h2>
          <div className="glass-card !p-12 space-y-6 bg-white shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Most Popular</p>
            <div className="space-y-2">
              <h3 className="text-3xl font-black">Pro Plan</h3>
              <div className="flex items-center justify-center gap-2">
                <span className="text-5xl font-black">$19</span>
                <span className="text-stone-400 font-bold">/ month</span>
              </div>
            </div>
            <ul className="space-y-4 text-left max-w-sm mx-auto pt-6">
              <li className="flex items-center gap-3 text-stone-600 font-bold"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Unlimited Invoices</li>
              <li className="flex items-center gap-3 text-stone-600 font-bold"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Automated Recovery Reminders</li>
              <li className="flex items-center gap-3 text-stone-600 font-bold"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Custom Brand Identity</li>
              <li className="flex items-center gap-3 text-stone-600 font-bold"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Priority Support</li>
            </ul>
            <button onClick={() => navigate('/register')} className="w-full py-5 bg-stone-900 text-white font-black text-lg rounded-2xl hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20">Get Started Now</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-warm-border px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-2 opacity-30">
            <CheckCircle2 className="w-5 h-5 text-stone-900" />
            <span className="font-black text-lg tracking-tighter text-stone-900 uppercase">StripeFlow</span>
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">&copy; 2026 StripeFlow Engine. All rights reserved.</p>
          <div className="flex gap-6 text-xs font-black uppercase tracking-widest text-stone-400">
            <a href="#" className="hover:text-stone-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-stone-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-stone-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
