"""Byte-faithful mirror of summitassetmanagement.com.

Crawls same-host HTML, follows every asset reference it can find -- including
paths buried in inline <script> strings (the homepage slider builds its 5 slides
that way) and url()/@import inside stylesheets -- and writes each response to
disk at the exact path the server serves it from. Nothing is rewritten, so the
local tree is the site.
"""

import os
import re
import sys
import time
import queue
import threading
from urllib.parse import urljoin, urlsplit, unquote

import requests
from bs4 import BeautifulSoup

ROOT = "https://www.summitassetmanagement.com/"
HOSTS = {"summitassetmanagement.com", "www.summitassetmanagement.com"}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")

ASSET_EXT = (
    "jpg jpeg png gif svg webp ico bmp css js pdf doc docx xls xlsx ppt pptx "
    "zip mp4 webm ogg mp3 wav woff woff2 ttf eot otf xml txt json"
).split()

# quoted strings that look like asset paths -- catches inline-JS image refs
INLINE_RE = re.compile(
    r"""['"]([^'"<>\s]+?\.(?:%s)(?:\?[^'"]*)?)['"]""" % "|".join(ASSET_EXT),
    re.IGNORECASE,
)
CSS_URL_RE = re.compile(r"""url\(\s*['"]?([^'")]+?)['"]?\s*\)""", re.IGNORECASE)
CSS_IMPORT_RE = re.compile(r"""@import\s+['"]([^'"]+)['"]""", re.IGNORECASE)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "*/*",
}

seen = set()
seen_lock = threading.Lock()
work = queue.Queue()
results = []
res_lock = threading.Lock()
BAD = '<>:"|?*'


def norm(url):
    """Drop the fragment; unify the host so www/non-www are one tree."""
    s = urlsplit(url)
    if s.scheme not in ("http", "https"):
        return None
    if s.hostname not in HOSTS:
        return None
    path = s.path or "/"
    q = ("?" + s.query) if s.query else ""
    return "https://www.summitassetmanagement.com" + path + q


def local_path(url):
    s = urlsplit(url)
    path = unquote(s.path)
    if path.endswith("/") or path == "":
        path += "index.html"
    parts = [p for p in path.split("/") if p not in ("", ".", "..")]
    if s.query:
        # httrack-style: keep the query in the filename so nothing collides
        parts[-1] = parts[-1] + "@" + s.query
    parts = ["".join("_" if c in BAD else c for c in p).rstrip(" .") for p in parts]
    return os.path.join(OUT, *parts)


def enqueue(url, kind):
    u = norm(url)
    if not u:
        return
    with seen_lock:
        if u in seen:
            return
        seen.add(u)
    work.put((u, kind))


def harvest_html(text, base):
    attrs = (
        ("a", "href"), ("link", "href"), ("script", "src"), ("img", "src"),
        ("img", "data-src"), ("iframe", "src"), ("embed", "src"),
        ("object", "data"), ("source", "src"), ("video", "src"),
        ("video", "poster"), ("audio", "src"), ("input", "src"),
        ("form", "action"), ("area", "href"), ("frame", "src"),
    )
    soup = BeautifulSoup(text, "html.parser")
    for tag, attr in attrs:
        for el in soup.find_all(tag):
            v = el.get(attr)
            if v:
                enqueue(urljoin(base, v.strip()), "auto")
    for el in soup.find_all(srcset=True):
        for cand in el["srcset"].split(","):
            bit = cand.strip().split(" ")[0]
            if bit:
                enqueue(urljoin(base, bit), "auto")
    for el in soup.find_all(style=True):
        for m in CSS_URL_RE.findall(el["style"]):
            enqueue(urljoin(base, m), "asset")
    for el in soup.find_all("style"):
        harvest_css(el.get_text() or "", base)
    # assets hiding in inline scripts / attributes the parser doesn't model
    for m in INLINE_RE.findall(text):
        if m.startswith(("data:", "mailto:", "tel:", "#")):
            continue
        enqueue(urljoin(base, m.replace("\\/", "/")), "auto")


def harvest_css(text, base):
    for m in list(CSS_URL_RE.findall(text)) + list(CSS_IMPORT_RE.findall(text)):
        m = m.strip()
        if m.startswith("data:") or not m:
            continue
        enqueue(urljoin(base, m), "asset")


def fetch(url, session, tries=3):
    last = None
    for i in range(tries):
        try:
            r = session.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
            return r
        except Exception as e:  # transient network trouble
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


def worker():
    session = requests.Session()
    while True:
        try:
            url, kind = work.get(timeout=8)
        except queue.Empty:
            return
        try:
            r = fetch(url, session)
            ctype = r.headers.get("Content-Type", "").split(";")[0].strip().lower()
            dest = local_path(url)
            if r.status_code == 200:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(dest, "wb") as f:
                    f.write(r.content)
                if ctype in ("text/html", "application/xhtml+xml"):
                    harvest_html(r.text, r.url)
                elif ctype == "text/css" or url.lower().split("?")[0].endswith(".css"):
                    harvest_css(r.text, r.url)
            with res_lock:
                results.append((r.status_code, len(r.content), ctype, url))
                n = len(results)
            if n % 25 == 0:
                print("  ... %d fetched, %d queued" % (n, work.qsize()), flush=True)
        except Exception as e:
            with res_lock:
                results.append((-1, 0, str(e)[:60], url))
        finally:
            work.task_done()
            time.sleep(0.05)  # be polite to a small Apache box


def main():
    os.makedirs(OUT, exist_ok=True)
    enqueue(ROOT, "page")
    for extra in ("robots.txt", "sitemap.xml", "favicon.ico"):
        enqueue(urljoin(ROOT, extra), "asset")
    threads = [threading.Thread(target=worker, daemon=True) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    ok = [r for r in results if r[0] == 200]
    bad = [r for r in results if r[0] != 200]
    total = sum(r[1] for r in ok)
    print("\n=== %d ok, %d failed, %.1f MB ===" % (len(ok), len(bad), total / 1e6))
    for r in sorted(bad):
        print("  FAIL %s %s" % (r[0], r[3]))
    with open(os.path.join(os.path.dirname(OUT), "mirror-report.txt"), "w",
              encoding="utf-8") as f:
        for st, size, ct, u in sorted(results, key=lambda x: x[3]):
            f.write("%s\t%s\t%s\t%s\n" % (st, size, ct, u))


if __name__ == "__main__":
    sys.exit(main())
