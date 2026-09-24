#!/usr/bin/env python3
"""Scrape yello.ae category listing pages into JSONL.

robots.txt allows /category/ and /company/ for User-agent: * (only /admin,
/edit, /sign-in, /user ... are disallowed), so this is a permitted crawl.
Still polite: 1 request at a time with a delay between requests.

Usage:
  python scrape.py --list                 # show category groups
  python scrape.py --group restaurants    # scrape one group
  python scrape.py --group restaurants --max-pages 2   # test run
  python scrape.py --all                  # scrape every mapped group
"""
import argparse
import html as htmllib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
BASE = "https://www.yello.ae"

# yello category slug -> CityBee kind + CityBee category slug
GROUPS = {
    "restaurants":       [("restaurants", "restaurant", "restaurants")],
    "hotels":            [("hotels", "hotel", "hotels")],
    "malls":             [("shopping-centres", "mall", "malls")],
    "gyms":              [("gyms", "gym", "gyms"), ("health-clubs", "gym", "gyms"), ("fitness", "gym", "gyms")],
    "salons":            [("beauty-salons", "salon", "salons")],
    "cafes":             [("cafes", "cafe", "cafes"), ("coffee-shops", "cafe", "cafes")],
    "bars":              [("pubs", "bar", "bars"), ("night-clubs", "bar", "bars")],
    "doctors":           [("doctors-and-clinics", "doctor", "doctors"), ("hospitals", "doctor", "doctors")],
    "shops":             [("supermarkets", "shop", "shops"), ("pharmacies", "shop", "shops")],
}

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "state.json")
OUT = os.path.join(HERE, "listings.jsonl")


def log(*a):
    print(*a, flush=True)


def fetch(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:
            if i == tries - 1:
                log(f"  !! fetch failed {url}: {e}")
                return None
            time.sleep(2 + 2 * i)
    return None


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    return htmllib.unescape(s).strip()


STREET_WORDS = re.compile(
    r"\b(floor|building|bldg|unit|shop|office|tower|plaza|"
    r"mall|centre|center|block|near|behind|opposite|opp\.|apartment|villa|"
    r"warehouse|industrial|zone|p\.?o\.? box|hotel|resort|resorts|complex|"
    r"village|cinema|hypermarket|supermarket|hospital|school|pharmacy|"
    r"restaurant|cafe|café)\b",
    re.I,
)
SUFFIX_WORDS = re.compile(r"\b(st\.?|street|rd\.?|road|ave\.?|avenue|blvd\.?|hwy\.?|highway)\b\.?$", re.I)


def _looks_like_area(cand: str, bold_parts) -> bool:
    """Keep only plausible area/locality labels; drop building/street fragments."""
    if not cand:
        return False
    # "Al Muraqqabat St" -> "Al Muraqqabat" (the street-name suffix is dropped)
    cand = SUFFIX_WORDS.sub("", cand).strip(" ,.-")
    if len(cand) < 3 or len(cand) > 32:
        return False
    if any(ch.isdigit() for ch in cand):
        return False
    if len(cand.split()) > 4:
        return False
    if STREET_WORDS.search(cand):
        return False
    low = cand.lower().strip(" .-")
    for b in bold_parts:
        bl = b.lower().strip(" .-")
        # typo/prefix fragment of the city itself ("Duba" vs "Dubai")
        if bl and (low.startswith(bl) or bl.startswith(low)):
            return False
    return True


def parse_page(html: str, yello_cat: str, kind: str, cb_cat: str):
    """Return list of dicts, one per listing block."""
    out = []
    # blocks start at <div class="company ..." id="cmap_N" data-cmpid="ID">
    parts = re.split(r'<div class="company[^"]*"[^>]*data-cmpid="(\d+)"', html)
    # parts[0] = before first block; then alternating (cmpid, block)
    for i in range(1, len(parts) - 1, 2):
        cmpid = parts[i]
        block = parts[i + 1]
        rec = {"cmpid": cmpid, "yello_category": yello_cat, "kind": kind, "category": cb_cat, "locality": None}

        m = re.search(r'<h3><a href="([^"]+)"[^>]*>(.*?)</a></h3>', block, re.S)
        if not m:
            continue
        rec["url"] = BASE + m.group(1)
        rec["name"] = strip_tags(m.group(2))

        m = re.search(r'<div class="address">(.*?)</div>', block, re.S)
        if m:
            addr_html = m.group(1)
            rec["address_html"] = addr_html
            # bold segments are places (city/area) the directory highlights
            rec["bold_parts"] = [strip_tags(x) for x in re.findall(r"<b>(.*?)</b>", addr_html, re.S)]
            rec["address"] = strip_tags(addr_html)
            # locality = last comma segment before the first bold part, when it
            # looks like an area name (not a building/street/typo fragment)
            plain_before = strip_tags(addr_html.split("<b>")[0]) if "<b>" in addr_html else rec["address"]
            segs = [s.strip() for s in plain_before.split(",") if s.strip()]
            if len(segs) >= 2:
                cand = segs[-1]
                if _looks_like_area(cand, [strip_tags(b) for b in re.findall(r"<b>(.*?)</b>", addr_html, re.S)]):
                    rec["locality"] = cand
        else:
            rec["address"] = ""
            rec["bold_parts"] = []
            rec["address_html"] = ""

        m = re.search(r'<div class="tagline">.*?</i>(.*?)</div>', block, re.S)
        rec["tagline"] = strip_tags(m.group(1)) if m else ""

        m = re.search(r'class="logo[^"]*"[^>]*data-bg="([^"]+)"', block)
        if not m:
            m = re.search(r'data-bg="([^"]+)"[^>]*class="logo', block)
        rec["logo"] = (BASE + m.group(1)) if m and m.group(1).startswith("/") else (m.group(1) if m else None)

        rec["verified"] = "fa-check-circle" in block

        m = re.search(r"<b>\+?(\d+)</b>\s*&nbsp;Years with us", block)
        rec["years_with_us"] = int(m.group(1)) if m else None

        m = re.search(r'fa-phone[^>]*></i>\s*<span><b>(.*?)</b></span>', block, re.S)
        if not m:
            m = re.search(r'fa-phone[^>]*></i>\s*<span>(.*?)</span>', block, re.S)
        rec["phone"] = strip_tags(m.group(1)) if m else None

        m = re.search(r'fa-calendar[^>]*></i>\s*<span>(.*?)</span>', block, re.S)
        if m:
            t = strip_tags(m.group(1))
            mm = re.search(r"(\d{4})", t)
            rec["established"] = int(mm.group(1)) if mm else None
        else:
            rec["established"] = None

        m = re.search(r'<div class="mapmarker[^"]*"[^>]*data-ltd="([\d.\-]+)"[^>]*data-lng="([\d.\-]+)"', block)
        if m:
            rec["lat"], rec["lng"] = float(m.group(1)), float(m.group(2))
        else:
            rec["lat"] = rec["lng"] = None

        m = re.search(r'<div class="rate">([\d.]+)</div>\s*([\d,]+)\s*Review', block, re.S)
        if m:
            rec["rating"] = float(m.group(1))
            rec["reviews"] = int(m.group(2).replace(",", ""))
        else:
            rec["rating"] = rec["reviews"] = None

        out.append(rec)
    return out


def total_pages(html: str, yello_cat: str) -> int:
    nums = [int(x) for x in re.findall(rf"/category/{re.escape(yello_cat)}/(\d+)", html)]
    return max(nums) if nums else 1


def load_state():
    if os.path.exists(STATE):
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    return {"done_pages": {}, "totals": {}}


def save_state(st):
    with open(STATE, "w", encoding="utf-8") as f:
        json.dump(st, f, indent=1)


def scrape_group(group, delay, max_pages=None):
    st = load_state()
    done = st["done_pages"].setdefault(group, [])
    seen_cmpids = set()
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            for line in f:
                try:
                    seen_cmpids.add(json.loads(line)["cmpid"])
                except Exception:
                    pass
    wrote = 0
    for yello_cat, kind, cb_cat in GROUPS[group]:
        first = fetch(f"{BASE}/category/{yello_cat}")
        if first is None:
            log(f"[{group}] page 1 of {yello_cat} failed; skipping")
            continue
        pages = total_pages(first, yello_cat)
        if max_pages:
            pages = min(pages, max_pages)
        st["totals"][yello_cat] = pages
        log(f"[{group}] {yello_cat}: {pages} pages (~{pages * 20} listings)")
        for p in range(1, pages + 1):
            key = f"{yello_cat}/{p}"
            if key in done:
                continue
            html = first if p == 1 else fetch(f"{BASE}/category/{yello_cat}/{p}")
            if html is None:
                continue
            recs = parse_page(html, yello_cat, kind, cb_cat)
            new = []
            for r in recs:
                if r["cmpid"] in seen_cmpids:
                    continue
                seen_cmpids.add(r["cmpid"])
                new.append(r)
            with open(OUT, "a", encoding="utf-8") as f:
                for r in new:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            wrote += len(new)
            done.append(key)
            if p % 25 == 0 or p == pages:
                save_state(st)
                log(f"  [{group}] {yello_cat} page {p}/{pages} — +{len(new)} new (total new {wrote})")
            time.sleep(delay)
    save_state(st)
    log(f"[{group}] DONE — {wrote} new listings this run")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--max-pages", type=int, default=None)
    ap.add_argument("--delay", type=float, default=1.0)
    a = ap.parse_args()
    if a.list:
        for g, cats in GROUPS.items():
            print(f"{g:14} -> " + ", ".join(c for c, _, _ in cats))
        return
    if a.all:
        for g in GROUPS:
            scrape_group(g, a.delay, a.max_pages)
    elif a.group:
        if a.group not in GROUPS:
            log(f"unknown group {a.group}; use --list")
            sys.exit(1)
        scrape_group(a.group, a.delay, a.max_pages)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
