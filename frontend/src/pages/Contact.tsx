import React from 'react';
import { Mail, MessageSquare } from 'lucide-react';

const Contact = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12 prose dark:prose-invert">
      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-6">Contact Support</h1>
      
      <p className="text-stone-600 dark:text-stone-300 mb-8">
        Need help setting up your webhooks, verifying your first payment recovery, or disputing a billing charge? We're here for you.
      </p>

      <div className="bg-white dark:bg-stone-800 border border-warm-border dark:border-stone-700 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
        <Mail className="w-10 h-10 text-emerald-500 mb-4" />
        <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2 mt-0">Support Email</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-6">
          Reach out directly to our engineering team. We typically respond within 12 hours.
        </p>
        <a 
          href="mailto:support@payrecover.com" 
          className="inline-flex items-center gap-2 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 px-6 py-3 rounded-xl font-bold hover:bg-stone-700 dark:hover:bg-white transition-colors no-underline"
        >
          <MessageSquare className="w-5 h-5" />
          support@payrecover.com
        </a>
      </div>
    </div>
  );
};

export default Contact;
