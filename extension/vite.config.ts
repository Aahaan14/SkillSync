import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'index.html'),
        background: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
        content_linkedin: resolve(import.meta.dirname, 'src/content/linkedin/extractor.ts'),
        content_generic: resolve(import.meta.dirname, 'src/content/generic/extractor.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          if (chunkInfo.name.startsWith('content')) {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});
