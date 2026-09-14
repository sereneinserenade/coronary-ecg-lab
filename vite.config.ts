import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';

// The site lives at https://<user>.github.io/coronary-ecg-lab/, so every asset
// URL needs that prefix. `npm run dev` serves from the same path for parity.
const base = process.env.BASE_PATH ?? '/coronary-ecg-lab/';

export default defineConfig({
  base,
  plugins: [tailwindcss(), solid()],
  resolve: { alias: { '~': new URL('./src', import.meta.url).pathname } },
  build: {
    target: 'es2022',
    // Three.js is most of the bundle and never changes between content edits.
    // Three.js is deliberately its own chunk, fetched after first paint, so the
    // default 500 kB warning is noise here.
    chunkSizeWarningLimit: 700,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // solid-js must be loaded through the plugin's dev export, not the browser
    // build, or reactivity silently no-ops under the test renderer.
    server: { deps: { inline: [/solid-js/, /@solidjs/, /@kobalte/] } },
  },
});
