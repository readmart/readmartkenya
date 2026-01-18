import { defineConfig } from "vite"; 
import react from "@vitejs/plugin-react"; 
import tailwindcss from "@tailwindcss/vite";
import path from "path"; 
import dns from 'node:dns'; 


dns.setDefaultResultOrder('verbatim'); 


export default defineConfig(() => ({ 
  server: { 
    host: "localhost", 
    port: 3006, 
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
  }, 
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } }, 
  plugins: [
    react(),
    tailwindcss(),
  ], 
})); 
