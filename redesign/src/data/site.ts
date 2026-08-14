// Single source of truth for content that repeats across pages.
// All copy here is taken verbatim from the existing summitassetmanagement.com
// -- nothing about a registered investment advisor should be invented.

export const firm = {
  name: 'Summit Asset Management',
  legalName: 'Summit Asset Management LLC',
  address: { street: '5100 Wheelis Drive, Suite 107', city: 'Memphis', state: 'TN', zip: '38117' },
  phone: '901.729.8100',
  phoneHref: 'tel:+19017298100',
  fax: '901.729.8101',
  email: 'info@summitassetmanagement.com',
  founded: 1991,
};

export const nav = [
  { label: 'Our Firm', href: '/our-firm' },
  { label: 'Our Team', href: '/our-team' },
  { label: 'Services', href: '/services' },
  { label: 'Views & News', href: '/news' },
  { label: 'Contact', href: '/contact' },
];

export const legalNav = [
  { label: 'Client Relationship Summary', href: '/client-relationship-summary' },
  { label: 'Privacy Notice', href: '/privacy-notice' },
  { label: 'Disclosures', href: '/disclosure' },
  { label: 'Terms of Service', href: '/terms-of-service' },
];

export const attributes = [
  { title: 'Founded 1991', body: 'Our advisors and firm average over 20 years of client service.' },
  { title: 'Mid-sized', body: 'We have a deep bench of professionals but keep a personal touch.' },
  {
    title: 'Independent',
    body: 'Summit is 100% employee owned. There’s no pressure from outside owners that might conflict with clients’ interests.',
  },
  { title: 'Clients', body: 'We serve select individuals, families, businesses, and non-profits.' },
  {
    title: '“Fee-only”',
    body: 'We are only compensated by a fee based on the amount of investments managed. We do not charge transaction fees, sales commissions, or loads.',
  },
  {
    title: 'Service not Sales',
    body: 'We do not sell products. We invest only in what we believe best fits the clients’ needs. No third parties pay Summit, only our clients.',
  },
];

// `name` stays short so it does not wrap to three lines in a narrow column;
// letters ride on the role line, which is how a directory sets them anyway.
export const team = [
  {
    name: 'Alex Thompson',
    credentials: 'CLU, ChFC',
    role: 'Chairman, Advisor',
    photo: '/img/alex_revised_hair-thumb180x220.jpg',
    email: 'alex@summitassetmanagement.com',
    href: '/our-team/chairmen/alex-thompson-clu-chfc',
  },
  {
    name: 'John N. Laughlin',
    credentials: 'CFP®',
    role: 'Principal, Advisor',
    photo: '/img/John_180x220-thumb180x220.jpg',
    email: 'john@summitassetmanagement.com',
    href: '/our-team/principals/john-n-laughlin',
  },
  {
    name: 'Lance Hollingsworth',
    credentials: 'CFP®',
    role: 'Principal, Advisor',
    photo: '/img/Lance_180x220-thumb180x220.jpg',
    email: 'lance@summitassetmanagement.com',
    href: '/our-team/principals/lance-hollingsworth-cfp',
  },
  {
    name: 'Peggy K. Adler',
    credentials: 'MBA',
    role: 'Principal',
    photo: '/img/peggy-thumb180x220.jpg',
    email: 'peggy@summitassetmanagement.com',
    href: '/our-team/principals/peggy-k-adler',
  },
  {
    name: 'Sarah Haizlip',
    credentials: '',
    role: 'Advisor',
    photo: '/img/Sarah-thumb180x220.jpg',
    email: 'sarah@summitassetmanagement.com',
    href: '/our-team/advisors/sarah-haizlip-ma',
  },
  {
    name: 'Leslie Drummond',
    credentials: 'CFP®',
    role: 'Advisor',
    photo: '/img/Leslie_180x220-thumb180x220.jpg',
    email: 'leslie@summitassetmanagement.com',
    href: '/our-team/advisors/leslie-drummond-cfp',
  },
  {
    name: 'Soleil Lum',
    credentials: 'CFP®',
    role: 'Associate',
    photo: '/img/Soleil_8_X_10_updated-thumb180x220.jpg',
    email: 'soleil@summitassetmanagement.com',
    href: '/our-team/associates/soleil-lum-cfp',
  },
];

export const letters = [
  { title: 'Client Letter — July 2026', href: '/letters/2026_0715_Client_Letter.pdf' },
  { title: 'Client Letter — April 2026', href: '/letters/2026_0415_Client-Letter.pdf' },
  { title: 'Client Letter — January 2026', href: '/letters/2026_0115_Client_Letter.pdf' },
  { title: 'Client Letter — October 2025', href: '/letters/2025-1015_Client-Letter.pdf' },
];
