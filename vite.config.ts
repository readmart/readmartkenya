import { defineConfig } from "vite"; 
import react from "@vitejs/plugin-react"; 
import tailwindcss from "@tailwindcss/vite";
import path from "path"; 
import dns from 'node:dns'; 


dns.setDefaultResultOrder('verbatim'); 


export default defineConfig(() => ({ 
  server: { 
    host: "localhost", 
    port: 3004, 
    strictPort: true, 
    proxy: { 
      '/api': { 
        target: 'http://127.0.0.1:3002', 
        changeOrigin: true, 
      }, 
    }, 
  }, 
  build: { 
    outDir: "dist", 
    rollupOptions: { 
      output: { 
        manualChunks: (id) => { 
          if (id.includes('node_modules')) { 
            if (id.includes('lucide-react')) return 'vendor-icons'; 
            if (id.includes('framer-motion')) return 'vendor-motion'; 
            if (id.includes('react')) return 'vendor-react'; 
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('zod') || id.includes('bcryptjs') || id.includes('jose')) return 'vendor-utils';
            return 'vendor'; 
          } 
        }, 
      }, 
    }, 
  }, 
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } }, 
  plugins: [
    react(),
    tailwindcss(),
  ], 
})); 
