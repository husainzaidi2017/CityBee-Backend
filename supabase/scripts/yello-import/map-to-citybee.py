#!/usr/bin/env python3
"""Map scraped yello.ae listings -> CityBee business rows (JSONL).

City resolution order:
  1. bold segment in the listing address that matches a known UAE city
  2. nearest UAE city by lat/lng (within 90 km)
  3. city name anywhere in the address text
  4. nearest city by lat/lng (no distance cap), else city left null

Tagline keeps yello's short factual descriptor (fallback: generated).
Description is generated from structured facts — no prose copied from yello
detail pages.
"""
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(HERE, "listings.jsonl")
OUT = os.path.join(HERE, "citybee_rows.jsonl")

UAE_CITIES = [
    ("dubai", "Dubai", 25.2048493, 55.2707828),
    ("abu-dhabi", "Abu Dhabi", 24.453884, 54.3773438),
    ("sharjah", "Sharjah", 25.3462553, 55.4209317),
    ("ajman", "Ajman", 25.4052165, 55.5136433),
    ("ras-al-khaimah", "Ras Al Khaimah", 25.8006926, 55.9761994),
    ("fujairah", "Fujairah", 25.1288099, 56.3264849),
    ("umm-al-quwain", "Umm Al Quwain", 25.56473, 55.55517),
    ("al-ain", "Al Ain", 24.130162, 55.802312),
]
# address-text aliases -> city slug
ALIASES = {
    "dubai": "dubai", "dubailand": "dubai", "jebel ali": "dubai", "deira": "dubai",
    "abu dhabi": "abu-dhabi", "abudhabi": "abu-dhabi", "al ain": "al-ain", "alain": "al-ain",
    "sharjah": "sharjah", "ajman": "ajman", "ras al khaimah": "ras-al-khaimah",
    "ras al-khaimah": "ras-al-khaimah", "ras alkhaimah": "ras-al-khaimah", "rak": "ras-al-khaimah",
    "fujairah": "fujairah", "umm al quwain": "umm-al-quwain", "ummalquwain": "umm-al-quwain",
    "u.a.q": "umm-al-quwain", "uaq": "umm-al-quwain",
}
KIND_NOUN = {
    "restaurant": "restaurant",
    "hotel": "hotel",
    "cafe": "café",
    "salon": "beauty salon",
    "gym": "fitness centre",
    "bar": "bar & nightlife venue",
    "mall": "shopping centre",
    "doctor": "medical clinic",
    "shop": "store",
    "service": "business",
}
CAT_LABEL = {
    "restaurants": "Restaurant", "hotels": "Hotel", "cafes": "Café", "salons": "Beauty Salon",
    "gyms": "Fitness Centre", "bars": "Bar", "malls": "Shopping Centre", "doctors": "Clinic",
    "shops": "Store",
}

# yello files some businesses under the wrong directory category (a transport
# company sits in "Hotels", a beauty lounge in "Fitness"). Business-name signals
# correct the obvious mismatches; restaurants/doctors are left alone because
# those names legitimately carry words like "cafe", "spa" or "clinic".
NAME_KIND_RULES = [
    (re.compile(r"\b(travel|tourism|tourist|transport|buses|rent a car|car rental|typing|visa)\b", re.I),
     "service", None),
    (re.compile(r"\b(salon|beauty|barber)\b", re.I), "salon", "salons"),
    (re.compile(r"\b(gym|fitness|crossfit|pilates)\b", re.I), "gym", "gyms"),
    (re.compile(r"\b(pub|night ?club)\b", re.I), "bar", "bars"),
]
PROTECTED_KINDS = {"restaurant", "doctor"}


def fix_kind(kind: str, category: str, name: str):
    """Correct obvious source miscategorisations by business name."""
    for rx, new_kind, new_cat in NAME_KIND_RULES:
        if not rx.search(name or ""):
            continue
        if kind == new_kind:
            return kind, category
        if kind == "hotel" and new_kind == "service":
            # travel/transport listed under Hotels — no CityBee category fits
            return "service", None
        if kind in PROTECTED_KINDS:
            return kind, category
        return new_kind, new_cat or category
    return kind, category


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"^-|-$", "", s)[:80] or "business"


def haversine(lat1, lng1, lat2, lng2):
    from math import radians, sin, cos, asin, sqrt
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(a))


def nearest_city(lat, lng, cap_km=None):
    best, bestd = None, 1e9
    for slug, name, clat, clng in UAE_CITIES:
        d = haversine(lat, lng, clat, clng)
        if d < bestd:
            best, bestd = (slug, name), d
    if cap_km is not None and bestd > cap_km:
        return None, None, bestd
    return best[0], best[1], bestd


def resolve_city(rec):
    # 1) bold parts (directory-highlighted place names)
    for b in rec.get("bold_parts") or []:
        low = b.lower().strip(" .-,")
        for alias, slug in ALIASES.items():
            if re.search(rf"(?<![a-z]){re.escape(alias)}(?![a-z])", low):
                return slug, slug.replace("-", " ").title()
    # 2) nearest by coords, within 90 km
    if rec.get("lat") and rec.get("lng"):
        slug, name, d = nearest_city(rec["lat"], rec["lng"], cap_km=90)
        if slug:
            return slug, name
        # 4) nearest with no cap
        slug, name, _ = nearest_city(rec["lat"], rec["lng"])
        return slug, name
    # 3) city name anywhere in the address
    addr = (rec.get("address") or "").lower()
    for alias, slug in ALIASES.items():
        if re.search(rf"(?<![a-z]){re.escape(alias)}(?![a-z])", addr):
            return slug, slug.replace("-", " ").title()
    return None, None


STREET_WORDS = re.compile(
    r"\b(floor|building|bldg|unit|shop|office|tower|plaza|"
    r"mall|centre|center|block|near|behind|opposite|opp\.|apartment|villa|"
    r"warehouse|industrial|zone|p\.?o\.? box|hotel|resort|resorts|complex|"
    r"village|cinema|hypermarket|supermarket|hospital|school|pharmacy|"
    r"restaurant|cafe|café)\b",
    re.I,
)
SUFFIX_WORDS = re.compile(r"\b(st\.?|street|rd\.?|road|ave\.?|avenue|blvd\.?|hwy\.?|highway)\b\.?$", re.I)


def _looks_like_area(cand, bold_parts):
    if not cand:
        return False
    cand = SUFFIX_WORDS.sub("", cand).strip(" ,.-")
    if len(cand) < 4 or len(cand) > 32:
        return False
    if any(ch.isdigit() for ch in cand):
        return False
    if len(cand.split()) > 4:
        return False
    if STREET_WORDS.search(cand):
        return False
    low = cand.lower().strip(" .-")
    for b in bold_parts or []:
        bl = (b or "").lower().strip(" .-")
        if bl and (low.startswith(bl) or bl.startswith(low)):
            return False
    return True


def derive_locality(rec):
    """Area label re-derived from the address (never trusts the raw scrape value,
    so heuristic updates apply to every row). Last sane comma segment before the
    first bold place name wins; else the one before it; else None."""
    addr_html = rec.get("address_html") or ""
    bold = rec.get("bold_parts") or []
    head = addr_html.split("<b>")[0] if "<b>" in addr_html else addr_html
    plain = re.sub(r"<[^>]+>", " ", head)
    plain = re.sub(r"\s+", " ", plain)
    segs = [s.strip(" ,.-") for s in plain.split(",") if s.strip(" ,.-")]
    for idx in (len(segs) - 1, len(segs) - 2):
        if idx >= 1 and _looks_like_area(segs[idx], bold):
            return segs[idx]
    return None


def norm_phone(p):
    if not p:
        return None
    s = " ".join(p.split())
    digits = re.sub(r"\D", "", s)
    nsn = None
    if digits.startswith("00971"):
        nsn = digits[5:]
    elif digits.startswith("971") and len(digits) >= 11:
        nsn = digits[3:]
    elif s.startswith("+971"):
        nsn = digits[3:]
    elif digits.startswith("0") and len(digits) in (9, 10):
        nsn = digits[1:]
    if not nsn:
        return s
    if len(nsn) == 8:
        return f"+971 {nsn[0]} {nsn[1:4]} {nsn[4:]}"
    if len(nsn) == 9:
        return f"+971 {nsn[:2]} {nsn[2:5]} {nsn[5:]}"
    return s


def make_tagline(rec, city_name):
    t = (rec.get("tagline") or "").strip().rstrip(".") 
    if t and len(t) <= 120:
        return t + "."
    cat = CAT_LABEL.get(rec["category"], "Business")
    return f"{cat} in {city_name or 'UAE'}."


def make_description(rec, city_name, locality):
    kind = KIND_NOUN.get(rec["kind"], "business")
    if locality and city_name and locality.lower() != city_name.lower():
        place = f"{locality}, {city_name}"
    else:
        place = city_name or locality or "the UAE"
    parts = [f"{rec['name']} is a {kind} located in {place}, United Arab Emirates."]
    t = (rec.get("tagline") or "").strip()
    if t:
        parts.append(t if t.endswith(".") else t + ".")
    if rec.get("established"):
        parts.append(f"Established in {rec['established']}.")
    if rec.get("rating") and rec.get("reviews"):
        parts.append(f"Rated {rec['rating']} out of 5 by {rec['reviews']} visitors.")
    if rec.get("phone"):
        parts.append(f"Call {rec['phone']} to get in touch.")
    return " ".join(parts)


def main():
    seen_refs, seen_slugs = set(), set()
    rows = []
    skipped_namedup = 0
    with open(IN, encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            ref = f"yello:{rec['cmpid']}"
            if ref in seen_refs:
                continue
            seen_refs.add(ref)

            name = (rec.get("name") or "").strip()
            if not name or len(name) < 2:
                continue

            city_slug, city_name = resolve_city(rec)
            locality = derive_locality(rec)
            kind, category = fix_kind(rec["kind"], rec["category"], name)

            base = slugify(name)
            slug = base
            if slug in seen_slugs:
                suffix = city_slug or rec["category"]
                slug = f"{base}-{suffix}"
                i = 2
                while slug in seen_slugs:
                    slug = f"{base}-{suffix}-{i}"
                    i += 1
                skipped_namedup += 1
            seen_slugs.add(slug)

            fixed = dict(rec, kind=kind, category=category)
            rows.append({
                "slug": slug,
                "name": name,
                "kind": kind,
                "category": category,
                "tagline": make_tagline(fixed, city_name),
                "description": make_description(fixed, city_name, locality),
                "phone": norm_phone(rec.get("phone")),
                "address": rec.get("address") or "",
                "locality": locality,
                "city_slug": city_slug,
                "lat": rec.get("lat"),
                "lng": rec.get("lng"),
                "rating": rec.get("rating"),
                "reviews": rec.get("reviews"),
                "verified": bool(rec.get("verified")),
                "established": rec.get("established"),
                "ext_ref": ref,
            })

    with open(OUT, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    from collections import Counter
    print(f"rows: {len(rows)}  (slug collisions resolved: {skipped_namedup})")
    print("by kind:", dict(Counter(r["kind"] for r in rows)))
    print("by city:", dict(Counter(r["city_slug"] for r in rows)))
    print("no city:", sum(1 for r in rows if not r["city_slug"]))
    print("no phone:", sum(1 for r in rows if not r["phone"]))
    print("with coords:", sum(1 for r in rows if r["lat"]))
    print("with rating:", sum(1 for r in rows if r["rating"]))


if __name__ == "__main__":
    main()
