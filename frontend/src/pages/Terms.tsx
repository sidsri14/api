import { Scale } from 'lucide-react';
import { motion } from 'framer-motion';

const Terms = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto py-20 px-6 sm:px-10"
    >
      <header className="mb-16 text-center">
        <div className="inline-flex p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 mb-6">
          <Scale className="w-8 h-8" />
        </div>
        <h1 className="text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">Terms of Service</h1>
        <p className="text-stone-400 font-medium">Last updated: April 14, 2026</p>
      </header>

      <div className="space-y-12 text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
        <section>
          <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold">01</span>
            Acceptance of Terms
          </h2>
          <p>
            By accessing or using PayRecover, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold">02</span>
            Use License
          </h2>
          <p className="mb-4">
            PayRecover grants you a limited, non-exclusive, non-transferable license to use the service for your business payment recovery needs. You may not:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm italic">
            <li>Attempt to decompile or reverse engineer any software contained in the platform</li>
            <li>Use the platform for any illegal automated messaging or spamming</li>
            <li>Exceed the rate limits of our API or connected payment providers</li>
            <li>Harvest customer email addresses for purposes other than payment recovery</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold">03</span>
            Data Processor Role
          </h2>
          <p>
            PayRecover acts as a <strong className="text-stone-900 dark:text-stone-100">Data Processor</strong> on behalf of you (the Merchant), who remains the Data Controller. You are responsible for ensuring your customers' consent for receiving recovery communications.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold">04</span>
            Payments & Subscriptions
          </h2>
          <p>
            You agree to pay all fees associated with your selected plan. Fees are non-refundable except as required by law. PayRecover reserves the right to change its pricing with a 30-day notice to active users.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold">05</span>
            Service Availability
          </h2>
          <p>
            While we strive for 99.9% uptime, PayRecover is provided on an "as-is" and "as-available" basis. We are not liable for any revenue loss arising from service interruptions or delays in recovery communication.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold">06</span>
            Termination
          </h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold">07</span>
            Governing Law
          </h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.
          </p>
        </section>
      </div>
    </motion.div>
  );
};

export default Terms;
