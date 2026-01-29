/**
 * Utility to retry a function multiple times with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    factor?: number;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const { 
    retries = 3, 
    delay = 1000, 
    factor = 2, 
    onRetry 
  } = options;

  let lastError: any;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt <= retries) {
        console.warn(`[Retry] Attempt ${attempt} failed: ${error.message || error}. Retrying in ${currentDelay}ms...`);
        if (onRetry) onRetry(error, attempt);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= factor;
      } else {
        console.error(`[Retry] All ${retries + 1} attempts failed. Last error: ${error.message || error}`);
      }
    }
  }

  throw lastError;
}
