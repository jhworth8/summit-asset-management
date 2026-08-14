"""Re-fetch every mirrored file and compare SHA-256 against the local copy."""

import os
import hashlib
import concurrent.futures as cf
from urllib.parse import quote

import requests

SITE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")
BASE = "https://www.summitassetmanagement.com/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}


def rel_urls():
    for dirpath, _, files in os.walk(SITE):
        for fn in files:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, SITE).replace("\\", "/")
            url = BASE + quote(rel)
            yield full, url


def check(pair):
    full, url = pair
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            return ("HTTP %s" % r.status_code, url)
        with open(full, "rb") as f:
            local = f.read()
        if hashlib.sha256(local).hexdigest() == hashlib.sha256(r.content).hexdigest():
            return ("OK", url)
        return ("HASH MISMATCH (local %d B, remote %d B)" % (len(local), len(r.content)), url)
    except Exception as e:
        return ("ERR %s" % str(e)[:50], url)


def main():
    pairs = list(rel_urls())
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        out = list(ex.map(check, pairs))
    ok = [o for o in out if o[0] == "OK"]
    bad = [o for o in out if o[0] != "OK"]
    print("verified %d/%d identical" % (len(ok), len(out)))
    for status, url in bad:
        print("  %s  %s" % (status, url))


if __name__ == "__main__":
    main()
