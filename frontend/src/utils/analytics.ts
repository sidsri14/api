/**
 * Analytics Utility
 * 
 * Provides a lightweight wrapper for event tracking.
 * Can be easily integrated with GA4, Plausible, or Mixpanel.
 */

type EventName = 
  | 'landing_page_view'
  | 'signup_click'
  | 'registration_success'
  | 'recovery_link_click'
  | 'dashboard_view';

export const trackEvent = (eventName: EventName, params?: Record<string, any>) => {
  // 1. Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[Analytics] Event: ${eventName}`, params);
  }

  // 2. Dispatch to GA4 (if gtag is available)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params);
  }

  // 3. Dispatch to Plank/Plausible or other providers
  // (Add logic here as needed)
};

export const initAnalytics = (measurementId?: string) => {
  if (!measurementId || typeof window === 'undefined') return;

  // Dynamically load GA4 script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }
  (window as any).gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId);
  
  console.log('[Analytics] Initialized GA4 with id:', measurementId);
};
