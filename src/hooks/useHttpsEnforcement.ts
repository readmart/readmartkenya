import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to enforce HTTPS in production
 */
export function useHttpsEnforcement() {
  const location = useLocation();

  useEffect(() => {
    // Only run in production and on the client side
    if (
      import.meta.env.PROD && 
      typeof window !== 'undefined' && 
      window.location.protocol === 'http:' &&
      !window.location.hostname.includes('localhost') &&
      !window.location.hostname.includes('127.0.0.1')
    ) {
      console.warn('Insecure connection detected. Redirecting to HTTPS...');
      window.location.replace(`https://${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, [location]);
}
