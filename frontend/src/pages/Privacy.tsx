import { Lock, ShieldCheck, Database, Scale } from 'lucide-react';
import { motion } from 'framer-motion';

const Privacy = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto py-20 px-6 sm:px-10"
    >
      <header className="mb-16 text-center">
        <div className="inline-flex p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-stone-400 font-medium">Last updated: April 14, 2026</p>
      </header>

      <div className="space-y-12 text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
        <section>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest">Data Processor Role</h2>
          </div>
          <p>
            InvoiceFlow operates as a <strong className="text-stone-900 dark:text-stone-100">Data Processor</strong> under GDPR and other global privacy frameworks. We process customer PII (including names and email addresses) solely at the direction of the Merchant (Data Controller) for the purpose of facilitating payment recovery.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest">Data Retention & Scrubbing</h2>
          </div>
          <p>
            We adhere to a policy of <strong className="text-stone-900 dark:text-stone-100">Storage Limitation</strong>. Personal data related to invoices and payment events is automatically anonymised or purged within 90 days (configurable via <code>DATA_RETENTION_DAYS</code>), unless longer retention is required for legal or accounting compliance.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest">Secret Management</h2>
          </div>
          <p>
            Merchant API keys and webhook secrets are encrypted at rest using industry-standard <strong className="text-stone-900 dark:text-stone-100">AES-256</strong>. Our system strictly follows the Principle of Least Privilege; we only request the specific API scopes required to facilitate recovery events.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest">Third-Party Sub-processors</h2>
          </div>
          <p>
            To provide our services, we use trusted sub-processors. These include:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-sm">
            <li><strong>Railway / Neon:</strong> Cloud infrastructure and database hosting.</li>
            <li><strong>Resend:</strong> Transactional email delivery.</li>
            <li><strong>Stripe:</strong> Payment processing and checkout.</li>
            <li><strong>Vercel:</strong> Static frontend hosting.</li>
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest">Security Commitment</h2>
          </div>
          <p>
            We implement comprehensive technical and organizational measures to protect your data. This includes end-to-end encryption for session cookies, forced HTTPS, and regular dependency audits to patch vulnerabilities.
          </p>
        </section>
      </div>
    </motion.div>
  );
};

export default Privacy;
