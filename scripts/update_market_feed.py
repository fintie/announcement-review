#!/usr/bin/env python3
"""Build a small public-link-only market feed from accessible RSS sources."""
import datetime as dt
import email.utils
import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

OUT = "data/market-feed.json"
SOURCES = [
    ("AFR", "Google News index", "https://news.google.com/rss/search?q=" + urllib.parse.quote('site:afr.com/companies OR site:afr.com/markets when:7d') + "&hl=en-AU&gl=AU&ceid=AU:en"),
    ("ASX", "Google News index", "https://news.google.com/rss/search?q=" + urllib.parse.quote('site:asx.com.au/markets/company when:7d') + "&hl=en-AU&gl=AU&ceid=AU:en"),
    ("Reddit", "Reddit public RSS", "https://www.reddit.com/r/ASX_Bets/new/.rss?limit=20"),
    ("Reddit", "Reddit public RSS", "https://www.reddit.com/r/AusFinance/new/.rss?limit=20"),
]
NS = {"atom": "http://www.w3.org/2005/Atom"}
def parse_date(value):
    try:
        return email.utils.parsedate_to_datetime(value).astimezone(dt.timezone.utc).isoformat()
    except (ValueError, TypeError, IndexError):
        try:
            return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
        except ValueError:
            return ""
def clean(value):
    return re.sub(r"\\s+", " ", re.sub(r"<[^>]+>", "", value or "")).strip()[:260]
def collect(source, via, url):
    req = urllib.request.Request(url, headers={"User-Agent": "AnnouncementReviewResearchFeed/0.1 (public link index)"})
    with urllib.request.urlopen(req, timeout=18) as response:
        data = response.read(1_500_000)
    root = ET.fromstring(data)
    result = []
    for item in root.findall(".//item"):
        title = clean(item.findtext("title"))
        link = (item.findtext("link") or "").strip()
        published = parse_date(item.findtext("pubDate"))
        if title and link.startswith("https://") and published:
            result.append({"source": source, "via": via, "title": title, "url": link, "published": published})
    for entry in root.findall("atom:entry", NS):
        title = clean(entry.findtext("atom:title", "", NS))
        links = entry.findall("atom:link", NS)
        link = next((e.attrib.get("href", "") for e in links if e.attrib.get("rel", "alternate") == "alternate"), "")
        published = parse_date(entry.findtext("atom:published", "", NS) or entry.findtext("atom:updated", "", NS))
        if title and link.startswith("https://") and published:
            result.append({"source": source, "via": via, "title": title, "url": link, "published": published})
    return result

def main():
    items, errors = [], []
    for source, via, url in SOURCES:
        try:
            items.extend(collect(source, via, url))
        except Exception as exc:
            errors.append(source + ": " + type(exc).__name__)
    seen, unique = set(), []
    for item in sorted(items, key=lambda x: x["published"], reverse=True):
        key = item["url"].split("?")[0]
        if key not in seen:
            unique.append(item)
            seen.add(key)
    os.makedirs("data", exist_ok=True)
    previous = {}
    if os.path.isfile(OUT):
        try:
            with open(OUT, encoding="utf-8") as f: previous = json.load(f)
        except (ValueError, OSError): pass
    if not unique and previous.get("items"):
        print("All sources failed; preserving previous feed")
        return
    payload = {"updated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "items": unique[:80], "source_errors": errors, "note": "Public RSS/index links only; not an official licensed ASX/AFR feed. Titles are not verified facts."}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Indexed", len(payload["items"]), "items; source errors:", errors)

if __name__ == "__main__": main()
