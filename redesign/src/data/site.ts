// Shared site data. The wording itself lives in src/content/ (editable at
// /admin); this module only shapes it for the pages.
import { existsSync } from 'node:fs';
import { getCollection, type CollectionEntry } from 'astro:content';
import siteContent from '../content/site.json';
import { p } from '../utils/paths';

export const firm = {
  ...siteContent,
  phoneHref: `tel:+1${siteContent.phone.replace(/\D/g, '')}`,
  mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${siteContent.street}, ${siteContent.city}, ${siteContent.state} ${siteContent.zip}`,
  )}`,
  founded: 1991,
};

export const documents = Object.fromEntries(
  Object.entries(siteContent.documents).map(([key, doc]) => [key, { ...doc, href: p(doc.file) }]),
) as Record<keyof typeof siteContent.documents, { title: string; date: string; file: string; href: string }>;

export const nav = [
  { label: 'Our Firm', href: p('/our-firm') },
  { label: 'Our Team', href: p('/our-team') },
  { label: 'Services', href: p('/services') },
  { label: 'Views & News', href: p('/news') },
  { label: 'Contact', href: p('/contact') },
];

export const legalNav = [
  { label: 'Client Relationship Summary', href: p('/client-relationship-summary') },
  { label: 'Privacy Notice', href: p('/privacy-notice') },
  { label: 'Disclosures', href: p('/disclosure') },
  { label: 'Terms of Service', href: p('/terms-of-service') },
];

const groupFolders = {
  chairman: 'chairmen',
  principals: 'principals',
  advisors: 'advisors',
  associates: 'associates',
} as const;

export type TeamMember = CollectionEntry<'team'>['data'] & {
  entry: CollectionEntry<'team'>;
  slug: string;
  href: string;
};

export async function getTeam(): Promise<TeamMember[]> {
  const entries = await getCollection('team', ({ data }) => !data.hidden);
  return entries
    .sort((a, b) => a.data.order - b.data.order)
    .map((entry) => {
      const slug = `${groupFolders[entry.data.group]}/${entry.id}`;
      return {
        ...entry.data,
        photo: p(entry.data.photo),
        editorialPhoto: entry.data.editorialPhoto ? p(entry.data.editorialPhoto) : '',
        entry,
        slug,
        href: p(`/our-team/${slug}`),
      };
    });
}

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function getLetters() {
  const entries = await getCollection('letters');
  return entries
    .map(({ data }) => {
      // A letter whose PDF is missing would publish a dead link; stop the
      // build instead so the problem is caught before it goes live.
      if (!/^https?:/.test(data.file) && !existsSync(`public${data.file}`)) {
        throw new Error(`Letter "${data.title}" points to ${data.file}, but that file is not in public/. Upload the PDF or fix the path.`);
      }
      return {
        ...data,
        href: p(data.file),
        year: data.date.getUTCFullYear(),
        label: `${monthYear.format(data.date)} ${data.kind.replace(/ letter$/i, '').replace(/^Quarterly /i, '')} Letter`
          .replace(/\b(\w)/g, (m) => m.toUpperCase()),
        monthYear: monthYear.format(data.date),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
