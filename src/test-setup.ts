// Mock environment variables
process.env.VITE_SUPABASE_URL = 'https://mock.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';

// Mock global fetch to handle relative URLs in tests
const originalFetch = global.fetch;
global.fetch = (url, config) => {
  const finalUrl = typeof url === 'string' && url.startsWith('/') 
    ? `http://localhost:3000${url}` 
    : url;
  return originalFetch(finalUrl, config);
};
