/**
 * Simple analytics utility for ReadMart
 * This can be expanded to link with GA4, Mixpanel, or custom backend logging.
 */

type EventName = 
  | 'page_view'
  | 'partnership_apply_start'
  | 'partnership_apply_submit'
  | 'partnership_filter_change'
  | 'partnership_search'
  | 'partner_profile_view';

interface EventProperties {
  [key: string]: any;
}

export const trackEvent = (name: EventName, properties?: EventProperties) => {
  // Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${name}:`, properties);
  }

  // In production, this would send to an external service
  // Example: window.gtag?.('event', name, properties);
  
  // Custom backend logging if needed
  // fetch('/api/analytics', { method: 'POST', body: JSON.stringify({ name, properties }) });
};
