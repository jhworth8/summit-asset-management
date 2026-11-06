# Publishing the new site to www.summitassetmanagement.com

Today the new site is published as a **preview** at
https://jhworth8.github.io/summit-asset-management/. The preview tells search
engines not to index it (`noindex` and a blocking `robots.txt`), so it never
competes with the current live site. Indexing switches on automatically once
the site is built for the official domain.

Where the site is published is controlled by two settings, not by code:

| Setting | Preview (now) | Official domain |
|---|---|---|
| `SITE_URL` | `https://jhworth8.github.io` | `https://www.summitassetmanagement.com` |
| `BASE_PATH` | `/summit-asset-management` | `/` |

## Before the switch

- [ ] The CCO has signed off on the content (see CONTENT-REVIEW.md).
- [ ] Find out who manages the domain's DNS (the registrar, or Telelink).
      **Only the web records change. Leave the email (MX) records alone**, or
      the firm's email stops working.
- [ ] Recommended: move the GitHub project into a GitHub **organization owned
      by the firm** (GitHub → Settings → Transfer ownership), so the firm owns
      its website rather than a personal account. Afterwards update `repo:`
      in `redesign/public/admin/config.yml`.

## Option A (recommended): serve the domain from GitHub Pages

The editor (EDITING.md) publishes automatically with this option.

1. In the GitHub project: **Settings → Secrets and variables → Actions →
   Variables**, add `SITE_URL` = `https://www.summitassetmanagement.com` and
   `BASE_PATH` = `/`.
2. **Settings → Pages → Custom domain**: enter `www.summitassetmanagement.com`
   and save. Tick **Enforce HTTPS** once it becomes available.
3. At the DNS provider:
   - `www` → **CNAME** → `jhworth8.github.io` (or `<organization>.github.io`)
   - the bare domain `summitassetmanagement.com` → **A** records
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
4. In `redesign/public/admin/config.yml`, change `site_url` and `display_url`
   to `https://www.summitassetmanagement.com`.
5. Re-run the deploy (**Actions → Deploy to GitHub Pages → Run workflow**) or
   push any commit.

DNS changes can take a few hours to reach everyone. The old site keeps
working until then.

## Option B: upload to the current host (Telelink)

```bash
cd redesign
SITE_URL=https://www.summitassetmanagement.com BASE_PATH=/ npm run build
```

Upload the contents of `redesign/dist/` to the web root. The included
`.htaccess` forwards old addresses. With this option, edits made in the
editor are **not** published automatically. Someone has to rebuild and
upload after every change, so Option A is recommended.

## Old addresses keep working

Links people already have (bookmarks, emails, search results) are forwarded:

- old team pages such as `/our-team/advisors/john-laughlin/` go to the new bio pages;
- `/news/commentary-letters/` goes to `/news/`; the old contact sub-pages go to `/contact/`;
- old PDF links (`/sites/400/uploaded/files/2026_0715_Client_Letter.pdf`) go
  to the same letter at `/letters/…`.

## After the switch: tell Google

1. In [Google Search Console](https://search.google.com/search-console), add
   the domain `summitassetmanagement.com` and verify it with the DNS record it
   gives you.
2. Submit `https://www.summitassetmanagement.com/sitemap.xml` under **Sitemaps**.
3. Check that the firm's Google Business Profile shows the same address and
   phone as the site.

The site already has a sitemap, page titles and descriptions, canonical
links, link-preview images and business details for Google. All of these
switch to the real domain automatically when `SITE_URL` changes.

## Worth knowing

- **Analytics:** the old site used Google Analytics (`G-RYZD2F62WK`). The new
  site has no tracking. Add it only if the firm wants it (and update the
  privacy notice if so).
- **Security headers:** the old host sent extra security headers (CSP, HSTS).
  GitHub Pages provides HTTPS but not custom headers. If those are required,
  serve the site through Cloudflare or Netlify instead (same build, same steps).
- **Annual updates:** when the firm files a new Form ADV (each March), upload
  it under **Firm Details & Documents** in the editor.
