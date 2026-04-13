import React from 'react';

const Terms = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12 prose dark:prose-invert">
      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-6">Terms of Service</h1>
      <p className="text-stone-600 dark:text-stone-300">
        Last updated: {new Date().toLocaleDateString()}
      </p>
      
      <h2 className="text-xl font-semibold mt-8 mb-4 text-stone-800 dark:text-stone-100">1. Acceptance of Terms</h2>
      <p className="text-stone-600 dark:text-stone-300 mb-4">
        By accessing and using PayRecover, you accept and agree to be bound by the terms and provision of this agreement. 
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4 text-stone-800 dark:text-stone-100">2. Service Description</h2>
      <p className="text-stone-600 dark:text-stone-300 mb-4">
        PayRecover provides a unified interface for automating failure recovery on Razorpay and other payment gateways.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4 text-stone-800 dark:text-stone-100">3. Liability</h2>
      <p className="text-stone-600 dark:text-stone-300 mb-4">
        We cannot guarantee that all failed payments will be successfully recovered. Our service operates as an automated messaging and facilitation layer.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4 text-stone-800 dark:text-stone-100">4. API Rate Limits & Use</h2>
      <p className="text-stone-600 dark:text-stone-300 mb-4">
        Users must not abuse the system architecture or purposefully submit false webhooks. Doing so will result in an immediate ban.
      </p>
    </div>
  );
};

export default Terms;
