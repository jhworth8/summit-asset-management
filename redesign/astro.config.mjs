// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Use subpath on GitHub Actions CI; use root for local development
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  site: isGitHubPages ? 'https://jhworth8.github.io' : 'http://localhost:4321',
  base: isGitHubPages ? '/summit-asset-management' : '/',
  output: 'static',
  vite: { plugins: [tailwindcss()] },
});
