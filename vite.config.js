import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 4100,
    strictPort: true,
    allowedHosts: ['.e2b.app'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4101',
        changeOrigin: true,
      },
    },
  },
});
