# Summit site image library

This folder is a copied, organized working library for the Summit Asset Management redesign. The source files in `public/img` remain untouched.

## Folders

- `00-currently-used` — images referenced by the current Astro site.
- `01-brand` — header and footer logo files.
- `02-team-portraits` — employee directory portraits, including Galactic Peggy.
- `03-team-editorial` — larger environmental and casual team photography.
- `04-broll-originals` — original office, client-service, and detail photographs.
- `05-broll-enhanced` — existing 1600px enhanced versions used by the redesign.
- `06-upscaled-approved` — approved high-resolution exterior versions. The full-frame file restores the verified sign text: “CLARK CENTRE” and “5101 WHEELIS DRIVE.” The 16:9 file is the sign-free video reference.
- `manifest.csv` — relative path, category, pixel dimensions, file size, and SHA-256 checksum for every copied image.

## Quality guidance

- Preserve original portraits whenever a face or identity matters.
- Use the enhanced 1600px b-roll for normal web sections; it is already large enough for the current layouts.
- Use the 4K exterior restoration for large still-image presentation.
- Use the 16:9 exterior crop as the safest animation source because it contains no small text for a video model to reinterpret.
- Keep originals available beside every enhanced derivative for truth checks.
