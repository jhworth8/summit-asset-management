# Summit Asset Management — full site mirror

A complete, byte-for-byte local copy of **https://www.summitassetmanagement.com/**,
captured 2026-08-12.

The live site is already a flat static HTML tree (Apache/2.4.52 on Ubuntu, hosted by
Telelink), so this is a true mirror rather than a reconstruction — every file here is
the identical file the server sends, and the page markup was not rewritten. Open
`site/index.html` and the whole site works offline.

## What's here

```
site/          the website (50 pages, 142 files, 8.9 MB)
tools/         the scripts used to capture and verify it
mirror-report.txt   every URL fetched, with status, size and content-type
```

| | |
|---|---|
| HTML pages | 50 |
| Images | 53 (JPG/PNG/GIF) |
| PDFs | 20 (client letters, ADV brochure, Form CRS, privacy notice) |
| Webfonts | OpenSans + Quattrocento, all 4 formats each |
| CSS / JS | 6 stylesheets, 5 scripts (jQuery 1.4.2, cycle, lightbox, thickbox) |
| Total | 8.9 MB |

## Verification

Three passes, all clean:

1. **Byte-identity** — every file re-fetched and SHA-256 compared against the
   local copy: **141/142 identical**. The one exception is a duplicate of
   `2025_0715_Client_Letter.pdf` saved under its `?v=2` query name; it is the same
   378,175 bytes as its plain twin.
2. **Completeness** — every asset path referenced from any HTML, CSS or JS file was
   resolved and checked. Everything that exists on the server is here; the only
   unresolved references are ones that 404 on the live site too (see below).
3. **Render** — served over HTTP and compared to the live site element by element.
   Geometry, fonts, colours, the 5-slide homepage carousel, the pager and all image
   loads match exactly (e.g. `#header` 950×120 at x=158, OpenSansRegular,
   `rgb(243,236,227)` on both).

## Things broken on the live site, reproduced as-is

These are faithful copies of the original's own dead references — not gaps in the
mirror. Worth knowing if the site ever gets rebuilt:

- **`sites/400/images/favicon.ico` is missing from the server**, and every page links
  it with a root-relative-looking path that is actually relative, so it 404s from every
  page. The site has no working favicon.
- `images/blue.jpg`, `images/loadingAnimation.gif` and the five
  `jscripts/images/lightbox-*.gif` files are referenced by the bundled thickbox and
  lightbox plugins but were never uploaded.
- The IE6/IE7 conditional stylesheets (`sites/400/css/ie6.css`, `ie7.css`) don't exist.
- No `robots.txt` and no `sitemap.xml`.
- The contact inquiry form is **commented out** in the page source, so it doesn't
  render or submit on the live site either. The reCAPTCHA script is still loaded.

## What a static mirror can't carry over

- **Server headers.** The live host sends a strict CSP, HSTS with preload,
  `X-Frame-Options: DENY`, `nosniff` and a `Referrer-Policy`. Re-apply these if this is
  ever redeployed.
- **External services** still point at their real hosts, exactly as on the live site:
  the Schwab Alliance and Tamarac client portals, the Google Maps embed, reCAPTCHA, and
  Google Analytics (`G-RYZD2F62WK`).
- The `<!-- Cached copy, generated HH:MM -->` footer comment is frozen at capture time.

## Viewing it

Open `site/index.html` directly, or serve it (better — matches live exactly):

```bash
python -m http.server 8123 --directory C:\Users\jesse\SummitAssetManagement\site
```

A `summit-mirror` entry was also added to `C:\.claude\launch.json`.

## Re-capturing later

```bash
python C:\Users\jesse\SummitAssetManagement\tools\mirror.py
```

Then `verify.py` (re-download and hash-compare), `fill_gaps.py` (catch assets
referenced only from inside JS/CSS) and `check_links.py` (internal link integrity).
