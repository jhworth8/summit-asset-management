import type { APIRoute } from 'astro';

// Only the official domain is indexed. The GitHub Pages preview stays out of
// search results so unapproved wording never competes with the live site.
export const GET: APIRoute = ({ site }) => {
  const official = site?.hostname.endsWith('summitassetmanagement.com');
  const sitemap = new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/sitemap.xml`, site);
  const body = official
    ? `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${sitemap}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
