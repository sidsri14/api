const CURRENCY_CONFIG: Record<string, { symbol: string, locale: string }> = {
  INR: { symbol: '₹', locale: 'en-IN' },
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'de-DE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  AED: { symbol: 'AED ', locale: 'en-AE' },
  CAD: { symbol: 'C$', locale: 'en-CA' },
  AUD: { symbol: 'A$', locale: 'en-AU' },
};

export const formatAmount = (subunits: number, currency = 'USD') => {
  const config = CURRENCY_CONFIG[currency.toUpperCase()] || { symbol: currency + ' ', locale: 'en-US' };
  
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(subunits / 100);
};

export const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const daysSince = (dateStr: string) =>
  Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
