// Team bios and commentary letters are collections so they can be added or
// removed as individual files (which is how the /admin editor manages them).
// The schemas make the build fail loudly on a malformed entry instead of
// publishing a broken page.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const optionalText = z.string().nullish().transform((value) => value ?? '');

const team = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/team' }),
  schema: z.object({
    name: z.string(),
    credentials: optionalText,
    title: z.string(),
    shortRole: z.string(),
    group: z.enum(['chairman', 'principals', 'advisors', 'associates']),
    order: z.number(),
    email: z.string().email(),
    photo: z.string(),
    editorialPhoto: optionalText,
    hidden: z.boolean().nullish().transform((value) => value ?? false),
  }),
});

const letters = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/letters' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    kind: z.string().nullish().transform((value) => value || 'Quarterly commentary letter'),
    file: z.string(),
  }),
});

export const collections = { team, letters };
