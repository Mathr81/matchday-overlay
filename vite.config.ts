import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const page = (p: string) => resolve(import.meta.dirname, 'src', p);

export default defineConfig({
  root: 'src',
  plugins: [svelte({ configFile: resolve(import.meta.dirname, 'svelte.config.js') })],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      input: { overlay16x9: page('overlay/16x9.html'), control: page('control/index.html') },
    },
  },
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:4455', ws: true },
      '/logos': 'http://localhost:4455',
    },
  },
});
