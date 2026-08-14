# Summit Asset Management — v2 redesign

A ground-up rebuild of summitassetmanagement.com in **Astro + Tailwind CSS v4**,
living in `redesign/`. It compiles to plain static HTML, so it deploys to the
same Apache host the current site runs on — no Node runtime in production.

## Status

| | |
|---|---|
| Built | Homepage, Services (interior template), styled 404 |
| Not yet built | The other ~31 pages — they fall through to the 404 for now |
| Source of truth | `../site/` (the verified mirror of the live site) |

```bash
npm --prefix C:\Users\jesse\SummitAssetManagement\redesign run dev
```

Then open http://localhost:4321. `npm run build` emits `dist/`, the whole
deployable site. A `summit-v2` entry also exists in `C:\.claude\launch.json`.

## The idea: a typeset private-client document

The first attempt was a dark hero, pill buttons and a numbered card grid — the
default look of every AI-generated "premium" site, with no idea behind it. This
version starts from something true about the firm instead.

Summit is **fee-only, employee-owned, no products, no commissions** — a fiduciary
whose whole case rests on transparency and continuity since 1991. So the site is
built as *a finely typeset client document* rather than a marketing page. That
gives it real devices to work with:

- **A table of contents with dot leaders** as the entry point to the page
- **Section marks** — § I, § II — and marginalia set in the outer column
- **Captioned plates** (`Fig. 1`, `Plate A`) instead of hero imagery
- **Ruled schedules** — term and gloss, hairline rules — instead of cards
- **Oldstyle figures** in running text, lining/tabular figures where numbers align
- Links underlined like a printed rule; **no pill buttons anywhere**

**One typeface**, EB Garamond, roman and italic, set at a 20px root — Garamond
runs small and the readership is not young. Labels are letterspaced caps in the
same family rather than the mono that had crept in.

**One accent.** Crimson `#a9122b`, the firm's existing colour, unchanged.
The brass from the previous pass is gone — it only ever existed to survive dark
backgrounds, so a paper-dominant page removes the need and the brand stays as it
was.

### Fig. 2 — the allocation decision

The homepage centrepiece is an **operable allocation band**. Summit's most
important sentence is *"a diversified portfolio's asset allocation has a greater
impact on future performance than any other factor"* — on the old site it sat
buried in a paragraph. Here it is the thing you actually work.

Three time horizons re-weight the band; selecting a sleeve names what the firm
holds there (all four descriptions trace to Summit's own asset-class list).

Details that matter:

- **Engraved hatching, not colour.** Sleeves are distinguished by texture —
  diagonal, ruled, cross-hatched, sparse — so the figure survives greyscale
  printing and colour-vision differences, and needs no colour-contrast
  compromise.
- **The band is a figure, never a control.** Giving the segments a minimum width
  to keep them tappable made the small sleeves render *wider than their true
  weight* on phones. A chart that misstates a proportion is worse than no chart,
  so the legend rows became the controls: full width, 62px tall, and the band
  now renders exact proportions at every screen size.
- `role="img"` with an `aria-label` that is rewritten on every re-weighting,
  `aria-pressed` on both control groups, and a polite live region for the
  detail line.
- Without JavaScript it renders the Balanced weighting with all four sleeve
  descriptions listed in full.

> ⚠️ **The percentages are invented placeholders.** They are layout scaffolding,
> not Summit's model portfolios. The firm must supply or approve real figures
> before this is published — and their CCO should review the whole figure, since
> anything resembling an allocation recommendation falls under the SEC Marketing
> Rule. A disclosure to that effect renders beneath the band.

### Why this also fixes the photography

The firm's best photographs are 938×406. Blown up behind a headline they look
cheap; set small, framed and captioned as plates, the same files look
deliberate. The constraint became the design.

## Critique pass — what changed and why

A structured critique (hierarchy, usability, consistency, accessibility) was run
against the live pages with everything measured rather than eyeballed. The
findings and their fixes:

| Finding | Measured | Fix |
|---|---|---|
| The allocation figure — the most distinctive thing here — sat below the fold | started at **1017px**, 117px past a 900px fold | Masthead compressed; the figure now starts at **579px**, above the fold |
| Page too long | **7,077px** (7.9 screens) | **5,292px** (5.9 screens) — attributes and services set two-up, letters and contact merged, the contents index four-across instead of four stacked rows |
| "Lots of plain white" — no tonal rhythm | `paper` vs `paper-2` measured **1.08:1**, effectively invisible | Three real surfaces: paper, a visible warm tint, and one dark board used exactly once (Our People) |
| Mobile menu button below tap-target minimum | **25×55px** | **87×55px**, clears 44×44 |
| Label type carrying the nav was small for this readership | 13.2px | Labels 14.4px; nav 15.6px |
| Marginal notes vanished on phones (`display:none`) | — | Inlined into the text column, so they exist at every width |
| Team names wrapped to three lines in a 124px column | — | Credentials moved to the role line; names now wrap to two at most |
| Everything oversized and empty on a wide monitor | `html` was set to **20px**, inflating every rem — spacing, gaps, max-widths and type — by 25% | Root to **18px**, headline cap 6.2rem → 4.6rem. Home is now **4,608px (5.1 screens)**, down from 7,077px |
| The band read as a striped slab, not a chart | 180px tall, 1px/6px hatch across 1,500px (moiré), no labels on it | Band to 108px, hatch coarsened and lightened, and **labels sit on the chart** — container queries show "Equities 55%" where there is room and just "9%" where there isn't, so nothing ever clips |
| Refreshing dumped you into the middle of the page | `history.scrollRestoration` was the browser default, `auto` | Reloads start at the top; back/forward still restore position |

Portraits are deliberately kept in a seven-across row: at 124px they render
*downscaled* from their 180px sources and stay crisp. A wider four-across grid
would upscale and soften them.

Mobile is 10,354px. That is a long page, but it is long because the content is
genuinely there — every trim that did not cost content has been taken (the
service schedule glosses drop below `sm`, keeping every term).

## Accessibility

Measured, not eyeballed — every text pair clears WCAG AA:

| Pair | Ratio | |
|---|---|---|
| Ink on paper | 16.67 | ✅ |
| Body text (ink-2) | 11.08 | ✅ |
| Captions and labels (ink-3) | 5.48 | ✅ |
| Captions on tinted bands | 5.06 | ✅ |
| Crimson on paper | 7.05 | ✅ |
| Crimson on tinted bands | 6.52 | ✅ |

Link underlines are drawn from `currentColor` at 45%, not from the rule colour —
at 1.64:1 the rule was too faint to serve as a link's only non-colour cue.

Also: semantic landmarks, `figure`/`figcaption` for every plate, real `<dl>`
schedules, a skip link, visible focus rings, `aria-current` on the active nav.

## Motion, and why it's defensive

Deliberately quiet: a soft fade, and rules that draw themselves in. Driven by
[Motion](https://motion.dev) rather than CSS scroll-driven animation, because
`animation-timeline` is **not Baseline** — Firefox stable still has it behind a
flag as of mid-2026 — so a CSS-only approach would silently do nothing for a
chunk of visitors.

Three guards, because invisible content on a financial firm's site is serious:

1. **Nothing is hidden in CSS.** With JS off the page is fully readable.
2. **Scroll-past sweep.** A single large jump (browser scroll restoration on
   refresh, or a deep anchor link) moves an element from intersection ratio 0 to
   ratio 0 without crossing a threshold, so the observer never fires and the
   element would stay invisible forever. A throttled scroll sweep catches it.
   *This was a real bug, reproduced and fixed.*
3. **Dead-observer failsafe.** If no reveal has fired 2.5s after load, all inline
   styles are stripped and the page is restored.

`prefers-reduced-motion` skips the motion layer entirely.

## Content integrity

All copy is verbatim from the existing site; nothing about a registered
investment advisor was invented. Plate captions describe what is actually in
each photograph.

> **One thing to raise with the firm.** `SAM_MG_0059` — used on the old site — is
> a shelf of **2011 award plaques** ("Memphis Wealth Managers", "Top RIA
> Ranking"). Third-party ratings in an RIA's advertising fall under the SEC
> Marketing Rule and generally need disclosure of the criteria and date, and
> these are fifteen years old. I have left it out of the rebuild. Their CCO
> should decide whether it goes back.

## Known constraints

- **Photography is still the ceiling.** The plate treatment makes 938×406 work,
  but high-resolution originals would let the design breathe further.
- **The logo is a 268×67 PNG.** It needs re-exporting as SVG, or at 2–3×, for
  retina screens.
- **Toolchain is pinned.** This machine runs Node 22.11; Vite 8 needs ≥22.12 and
  npm silently skips its native binding, breaking the build. Astro is held at
  5.14 (Vite 6) and vite is overridden tree-wide. Upgrade Node, then remove both
  pins in `package.json`.
- Email addresses are plain `mailto:` links; the old site obfuscated them with
  JavaScript against scrapers. Worth confirming.
