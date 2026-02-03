import { defineConfig } from "vite"; 
import react from "@vitejs/plugin-react"; 
import tailwindcss from "@tailwindcss/vite";
import path from "path"; 
import dns from 'node:dns'; 


dns.setDefaultResultOrder('verbatim'); 


export default defineConfig(() => ({ 
  server: { 
    host: "localhost", 
    port: 0, 
    strictPort: false, 
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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'recharts-vendor';
            }
            if (id.includes('supabase') || id.includes('postgrest-js') || id.includes('realtime-js') || id.includes('storage-js')) {
              return 'supabase-vendor';
            }
            if (id.includes('framer-motion')) {
              return 'motion-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-vendor';
            }
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
