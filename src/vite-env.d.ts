/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_JWT_SECRET: string
  readonly VITE_FOUNDER_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'framer-motion';
declare module 'lucide-react';
declare module 'recharts';
declare module 'sonner';
