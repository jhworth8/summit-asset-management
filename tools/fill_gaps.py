"""Second pass: scan every downloaded js/css/html for asset paths the crawler
missed (external JS string literals, mainly) and fetch any that are absent."""

import os
import re
from urllib.parse import urljoin, urlsplit, unquote, quote

import requests

SITE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")
BASE = "https://www.summitassetmanagement.com/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}

EXT = ("jpg jpeg png gif svg webp ico bmp css js pdf woff woff2 ttf eot otf "
       "mp4 webm mp3 swf").split()
REF_RE = re.compile(
    r"""['"(]([A-Za-z0-9_\-./]+?\.(?:%s))(?:[?#][^'")]*)?['")]""" % "|".join(EXT),
    re.IGNORECASE,
)


def main():
    candidates = set()
    for dirpath, _, files in os.walk(SITE):
        for fn in files:
            if not fn.lower().endswith((".js", ".css", ".html")):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, SITE).replace("\\", "/")
            page = BASE + quote(rel)
            with open(full, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
            for m in REF_RE.findall(text):
                if m.startswith(("http:", "https:", "//", "data:")):
                    continue
                url = urljoin(page, m)
                if urlsplit(url).hostname not in (
                    "summitassetmanagement.com", "www.summitassetmanagement.com"):
                    continue
                candidates.add(url)

    missing = []
    for url in sorted(candidates):
        rel = unquote(urlsplit(url).path).lstrip("/")
        dest = os.path.join(SITE, *rel.split("/"))
        if not os.path.exists(dest):
            missing.append((url, dest))

    print("%d referenced assets, %d absent locally" % (len(candidates), len(missing)))
    got = 0
    for url, dest in missing:
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
        except Exception as e:
            print("  ERR  %s (%s)" % (url, str(e)[:40]))
            continue
        if r.status_code == 200:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(r.content)
            print("  GOT  %s (%d B)" % (url, len(r.content)))
            got += 1
        else:
            print("  %s  %s  [broken on live site too]" % (r.status_code, url))
    print("recovered %d file(s)" % got)


if __name__ == "__main__":
    main()
