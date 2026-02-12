declare module '@supabase/supabase-js' {
  export * from '@supabase/supabase-js/dist/module/index';
}

declare module '@vercel/analytics' {
  export function track(event: string, properties?: Record<string, unknown>): void;
  export function inject(options?: unknown): void;
}
