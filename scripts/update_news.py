#!/usr/bin/env python3
"""Build a small, source-linked news feed from public RSS feeds."""
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from html import unescape

FEEDS = [
    ("Agência Brasil", "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml"),
    ("Agência Senado", "https://www12.senado.leg.br/noticias/rss.xml"),
    ("Agência Câmara", "https://www.camara.leg.br/noticias/rss/ultimas-noticias"),
]
KEYWORDS = {
    "Política": ("política", "governo", "presidente", "ministro", "partido", "eleição", "eleitoral", "planalto"),
    "Congresso": ("senado", "câmara", "deputado", "senador", "congresso", "comissão", "projeto de lei"),
    "Justiça": ("stf", "supremo", "stj", "justiça", "tribunal", "pf", "polícia federal", "ministro"),
    "Economia": ("economia", "inflação", "juros", "dólar", "ibovespa", "orçamento", "imposto", "fiscal"),
    "Geopolítica": ("mundo", "internacional", "guerra", "ucrânia", "rússia", "estados unidos", "china", "onu", "israel"),
}
NOW = datetime.now(timezone.utc)

def text_of(node, names):
    for name in names:
        el = node.find(name)
        if el is not None and el.text:
            return unescape(re.sub(r"<[^>]+>", " ", el.text)).strip()
    return ""

def parse_date(raw):
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            return None

def classify(title, summary):
    hay = (title + " " + summary).lower()
    for category, words in KEYWORDS.items():
        if any(word in hay for word in words):
            return category
    return "Brasil"

items, seen = [], set()
for source, url in FEEDS:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Politica360-NewsBot/1.0"})
        with urllib.request.urlopen(req, timeout=20) as response:
            root = ET.fromstring(response.read())
        nodes = root.findall(".//item")
        if not nodes:
            nodes = root.findall(".//{*}entry")
        for node in nodes:
            title = text_of(node, ["title", "{*}title"])
            link = text_of(node, ["link", "{*}link"])
            if not link:
                link_el = node.find("{*}link")
                if link_el is not None:
                    link = link_el.attrib.get("href", "")
            summary = text_of(node, ["description", "summary", "{*}summary", "{*}content"])
            raw_date = text_of(node, ["pubDate", "published", "updated", "{*}published", "{*}updated"])
            published = parse_date(raw_date)
            if not title or not link.startswith("https://") or not published:
                continue
            if NOW - published > timedelta(hours=48) or published > NOW + timedelta(hours=2):
                continue
            key = re.sub(r"\W+", "", title.lower())
            if key in seen:
                continue
            seen.add(key)
            items.append({
                "title": title[:220],
                "summary": summary[:420],
                "url": link,
                "source": source,
                "category": classify(title, summary),
                "published": published.isoformat(),
            })
    except Exception as exc:
        print(f"Feed indisponível: {source}: {exc}")

items.sort(key=lambda item: item["published"], reverse=True)
payload = {
    "updated_at": NOW.isoformat(),
    "count": min(len(items), 15),
    "items": items[:15],
}
Path("noticias-auto.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Arquivo gerado com {payload['count']} notícias.")
