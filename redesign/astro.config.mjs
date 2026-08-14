// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.summitassetmanagement.com',
  // Static output -- `npm run build` emits plain HTML into dist/, which drops
  // straight onto the existing Apache host with no Node runtime required.
  output: 'static',
  vite: { plugins: [tailwindcss()] },
});
