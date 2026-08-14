// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://jhworth8.github.io',
  base: '/summit-asset-management',
  output: 'static',
  vite: { plugins: [tailwindcss()] },
});
