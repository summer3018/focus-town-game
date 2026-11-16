import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './vite-plugin-sw';

export default defineConfig({
  base: './',
  plugins: [serviceWorkerPlugin()],
  server: { host: true, port: 5173 },
  build: { target: 'es2020', outDir: 'dist' },
});
