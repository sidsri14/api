import React from 'react';

const Privacy = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12 prose dark:prose-invert">
      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-6">Privacy Policy</h1>
      <p className="text-stone-600 dark:text-stone-300">
        Last updated: {new Date().toLocaleDateString()}
      </p>
      
      <h2 className="text-xl font-semibold mt-8 mb-4 text-stone-800 dark:text-stone-100">1. Data Processor Agreement</h2>
      <p className="text-stone-600 dark:text-stone-300 mb-4">
        PayRecover acts as a Data Processor. We temporarily cache customer Personally Identifiable Information (PII) such as emails and phone numbers strictly for the purpose of dispatching payment recovery links.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4 text-stone-800 dark:text-stone-100">2. Data Retention</h2>
      <p className="text-stone-600 dark:text-stone-300 mb-4">
        Logs concerning failed payments are securely scrubbed and archived once the payment is successfully recovered, or after 30 days of inactivity.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4 text-stone-800 dark:text-stone-100">3. Credentials Security</h2>
      <p className="text-stone-600 dark:text-stone-300 mb-4">
        API strings and webhook secrets are strongly encrypted at rest using AES-256 protocols. We do not store plaintext secrets that can directly initiate charges on your behalf.
      </p>
    </div>
  );
};

export default Privacy;
