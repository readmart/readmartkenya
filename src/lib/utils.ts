import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utility to handle lazy loading errors (e.g. after a new deployment)
 * by forcing a page reload to fetch the latest assets.
 */
export function lazyRetry<T>(componentImport: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    // Check if we've already tried to reload the page for this session
    const hasRetried = window.sessionStorage.getItem('rm_retry_count');

    componentImport()
      .then((res) => {
        // Successful load, clear the retry flag
        window.sessionStorage.removeItem('rm_retry_count');
        resolve(res);
      })
      .catch((error) => {
        // Only retry if we haven't already retried in this session
        if (!hasRetried) {
          console.warn('Chunk load failed, retrying page reload...', error);
          window.sessionStorage.setItem('rm_retry_count', '1');
          window.location.reload();
          return;
        }
        
        // If we've already retried and it still fails, reject
        console.error('Chunk load failed after retry:', error);
        reject(error);
      });
  });
}
