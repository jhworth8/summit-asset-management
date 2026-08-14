"""Walk every local page and confirm each internal href/src resolves on disk."""

import os
from urllib.parse import urljoin, urlsplit, unquote

from bs4 import BeautifulSoup

SITE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")
ATTRS = (("a", "href"), ("link", "href"), ("script", "src"), ("img", "src"),
         ("iframe", "src"), ("embed", "src"), ("object", "data"))

# references that 404 on the live server as well -- reproduced faithfully
KNOWN_LIVE_404 = ("favicon.ico", "ie6.css", "ie7.css", "loadingAnimation.gif",
                  "lightbox-blank.gif", "lightbox-btn-", "lightbox-ico-", "blue.jpg")

pages = 0
broken = []
external = set()

for dirpath, _, files in os.walk(SITE):
    for fn in files:
        if not fn.lower().endswith(".html"):
            continue
        pages += 1
        full = os.path.join(dirpath, fn)
        rel = os.path.relpath(full, SITE).replace("\\", "/")
        with open(full, "r", encoding="utf-8", errors="ignore") as f:
            soup = BeautifulSoup(f.read(), "html.parser")
        for tag, attr in ATTRS:
            for el in soup.find_all(tag):
                v = (el.get(attr) or "").strip()
                if not v or v.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
                    continue
                if v.startswith(("http://", "https://", "//")):
                    external.add(v.split("?")[0])
                    continue
                target = urljoin("/" + rel, v)
                path = unquote(urlsplit(target).path).lstrip("/")
                if path.endswith("/"):
                    path += "index.html"
                dest = os.path.join(SITE, *path.split("/"))
                if not os.path.exists(dest):
                    if any(k in v for k in KNOWN_LIVE_404):
                        continue
                    broken.append((rel, v))

print("checked %d pages" % pages)
print("broken internal references: %d" % len(broken))
for page, ref in broken:
    print("   %s  ->  %s" % (page, ref))
print("\nexternal hosts referenced:")
for e in sorted(external):
    print("   " + e)
