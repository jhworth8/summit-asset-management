// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Where the site is published is set by two environment variables, so moving
// from the GitHub Pages preview to the official domain needs no code change:
//
//   GitHub Pages preview (default in CI): SITE_URL=https://jhworth8.github.io  BASE_PATH=/summit-asset-management
//   Official domain:                      SITE_URL=https://www.summitassetmanagement.com  BASE_PATH=/
//
// See PUBLISHING.md. Local development serves from the root.
const site = process.env.SITE_URL || 'http://localhost:4321';
const base = process.env.BASE_PATH || '/';
// Astro does not add the base path to redirect destinations itself.
const to = (path) => `${base.replace(/\/$/, '')}${path}/`;

export default defineConfig({
  site,
  base,
  output: 'static',
  // Addresses from the old summitassetmanagement.com that have a direct
  // equivalent here. Old PDF links are forwarded by the 404 page.
  redirects: {
    '/our-team/advisors/alex-thompson': to('/our-team/chairmen/alex-thompson-clu-chfc'),
    '/our-team/advisors/john-laughlin': to('/our-team/principals/john-n-laughlin'),
    '/our-team/advisors/lance-hollingsworth': to('/our-team/principals/lance-hollingsworth-cfp'),
    '/our-team/principals/john-n-laughlin-mba-': to('/our-team/principals/john-n-laughlin'),
    '/news/commentary-letters': to('/news'),
    '/contact/our-location': to('/contact'),
    '/contact/map': to('/contact'),
    '/contact/inquiry-form': to('/contact'),
  },
  vite: { plugins: [tailwindcss()] },
});
