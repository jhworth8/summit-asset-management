import type { APIRoute } from 'astro';
import { getTeam } from '../data/site';

// Every public page, for search engines. Bio pages come from the team
// collection, so adding or hiding someone in the editor updates this too.
const pages = [
  '/',
  '/our-firm/',
  '/our-firm/attributes/',
  '/our-firm/history/',
  '/our-team/',
  '/services/',
  '/services/investment-management/',
  '/services/financial-planning/',
  '/news/',
  '/contact/',
  '/client-access/',
  '/disclosure/',
  '/client-relationship-summary/',
  '/privacy-notice/',
  '/terms-of-service/',
];

export const GET: APIRoute = async ({ site }) => {
  const team = await getTeam();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const urls = [...pages, ...team.map((person) => `/our-team/${person.slug}/`)].map(
    (path) => `  <url><loc>${new URL(`${base}${path}`, site)}</loc></url>`,
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
