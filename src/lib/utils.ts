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
      .then(resolve)
      .catch((error) => {
        if (!hasRetried) {
          window.sessionStorage.setItem('rm_retry_count', '1');
          window.location.reload();
          return;
        }
        reject(error);
      });
  });
}
