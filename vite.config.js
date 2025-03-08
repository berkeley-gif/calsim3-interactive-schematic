import { defineConfig } from "vite";
import { resolve } from 'path';

export default defineConfig({
  // Base public path
  base: '/',
  
  // Configure server options
  server: {
    port: 3000,
    open: true, // Opens the browser automatically
  },
  
  // Configure build options
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  
  // Resolve paths
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['d3'],
  },
});
