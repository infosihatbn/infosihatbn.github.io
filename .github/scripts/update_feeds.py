"""Fetch live content for the MataKitani home-page banner and write data/feeds.json.

Runs daily in GitHub Actions (see .github/workflows/update-feeds.yml). Standard library only.
Each section is replaced only when its source answers with at least one item, so a source
that is down keeps yesterday's items instead of emptying the banner.
"""
import datetime as dt, email.utils, html, json, os, re, sys, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

OUT = sys.argv[1] if len(sys.argv) > 1 else "data/feeds.json"
UA = {"User-Agent": "MataKitani-feed-bot/1.0 (+https://infosihatbn.github.io)"}
NOW = dt.datetime.now(dt.timezone.utc)

def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()

def clean(t):
    return re.sub(r"\s+", " ", html.unescape(t or "")).strip()

# 1. Brunei health news (Google News RSS search)
NEWS_Q = 'Brunei (health OR hospital OR "Ministry of Health" OR clinic OR disease OR doctors) when:14d'
HEALTH_RE = re.compile(r"\b(health\w*|hospital\w*|MOH|clinic\w*|disease\w*|doctors?|nurs\w+|patients?|medic\w*|vaccin\w*|dengue|covid\w*|influenza|flu|virus\w*|infect\w*|outbreak|diabet\w*|cancer|heart|stroke|mental|obesity|smok\w*|vap\w*|air quality|haze|eye|vision|blind\w*|dialysis|kidney|pharmac\w*|drugs?|surgery|screening|wellness|nutrition|ambulance|RIPAS|JPMC)\b", re.I)
def news():
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": NEWS_Q, "hl": "en-SG", "gl": "SG", "ceid": "SG:en"})
    root = ET.fromstring(get(url))
    items, seen = [], set()
    for it in root.iter("item"):
        title = clean(it.findtext("title"))
        src = clean(it.findtext("source"))
        if src and title.endswith(" - " + src):
            title = title[: -len(src) - 3]
        key = title.lower()[:80]
        if not title or key in seen or not HEALTH_RE.search(title):
            continue
        seen.add(key)
        try:
            d = email.utils.parsedate_to_datetime(it.findtext("pubDate")).date().isoformat()
        except Exception:
            d = ""
        items.append({"t": title, "src": src, "url": clean(it.findtext("link")), "d": d})
    items.sort(key=lambda x: x["d"], reverse=True)
    return items[:6]

# 2. New eye research from leading ophthalmology journals (PubMed E-utilities)
JOURNALS = ["Ophthalmology", "JAMA Ophthalmol", "Am J Ophthalmol", "Br J Ophthalmol", "Prog Retin Eye Res",
            "Surv Ophthalmol", "Ophthalmol Retina", "Ophthalmol Glaucoma", "Invest Ophthalmol Vis Sci",
            "Eye (Lond)", "Acta Ophthalmol", "Retina", "Asia Pac J Ophthalmol (Phila)", "Ophthalmol Sci"]
NICE = {"JAMA Ophthalmol": "JAMA Ophthalmology", "Am J Ophthalmol": "American Journal of Ophthalmology", "Br J Ophthalmol": "British Journal of Ophthalmology",
        "Prog Retin Eye Res": "Progress in Retinal and Eye Research", "Surv Ophthalmol": "Survey of Ophthalmology", "Ophthalmol Retina": "Ophthalmology Retina",
        "Ophthalmol Glaucoma": "Ophthalmology Glaucoma", "Invest Ophthalmol Vis Sci": "IOVS", "Eye (Lond)": "Eye", "Acta Ophthalmol": "Acta Ophthalmologica",
        "Asia Pac J Ophthalmol (Phila)": "Asia-Pacific Journal of Ophthalmology", "Ophthalmol Sci": "Ophthalmology Science"}
JOURNAL_Q = "(" + " OR ".join(f'"{j}"[ta]' for j in JOURNALS) + ")"
TYPES_Q = "(journal article[pt] OR review[pt]) NOT (comment[pt] OR letter[pt] OR editorial[pt] OR published erratum[pt] OR retracted publication[pt] OR news[pt])"
EU = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
def sea():
    q = {"db": "pubmed", "term": f"{JOURNAL_Q} AND {TYPES_Q} AND hasabstract", "retmax": "12", "retmode": "json",
         "datetype": "edat", "reldate": "21", "tool": "infosihat"}
    ids = json.loads(get(EU + "esearch.fcgi?" + urllib.parse.urlencode(q)))["esearchresult"]["idlist"]
    if not ids:
        return []
    res = json.loads(get(EU + "esummary.fcgi?" + urllib.parse.urlencode({"db": "pubmed", "id": ",".join(ids), "retmode": "json", "tool": "infosihat"})))["result"]
    out = []
    for i in ids:
        r = res.get(i) or {}
        t = clean(re.sub(r"<[^>]+>", "", r.get("title", ""))).rstrip(".")
        if t and not re.match(r"(erratum|correction|reply|re:|comment on|in memoriam)", t, re.I):
            out.append({"t": t, "src": NICE.get(clean(r.get("source", "")), clean(r.get("source", ""))), "d": clean(r.get("pubdate", "")), "url": f"https://pubmed.ncbi.nlm.nih.gov/{i}/"})
    return out[:6]

# 3. Eye articles in the Brunei International Medical Journal (MOH contents page)
BIMJ_URL = os.environ.get("BIMJ_URL", "https://moh.gov.bn/draft-bimj-page/")
EYE_RE = re.compile(r"\b(eyes?|ocular|ophthalm\w*|retin\w*|glaucom\w*|cataracts?|myopi\w*|amblyop\w*|strabism\w*|squint|cornea\w*|kerat\w*|uveit\w*|vision|visual|eyelids?|orbital|optic|macula\w*|vitre\w*|conjunctiv\w*|blind\w*|pterygium|ptosis|endophthalm\w*)\b", re.I)
BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "tr", "div", "section", "article", "figcaption", "dt", "dd"}

class Blocks(HTMLParser):
    def __init__(self):
        super().__init__(); self.blocks, self.buf, self.bold, self.inb, self.href, self.skip = [], [], [], 0, None, 0
    def flush(self):
        t = clean("".join(self.buf))
        if t: self.blocks.append((t, self.href, clean("".join(self.bold))))
        self.buf, self.bold, self.href = [], [], None
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "footer", "header"): self.skip += 1
        if tag in BLOCK: self.flush()
        if tag == "a" and self.href is None:
            h = dict(attrs).get("href")
            if h and h.lower().endswith(".pdf"): self.href = h
        if tag == "br": self.buf.append(" ")
        if tag in ("strong", "b"): self.inb += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer", "header"): self.skip = max(0, self.skip - 1)
        if tag in ("strong", "b"): self.inb = max(0, self.inb - 1)
        if tag in BLOCK: self.flush()
    def handle_data(self, d):
        if not self.skip:
            self.buf.append(d)
            if self.inb: self.bold.append(d)

def bimj():
    p = Blocks(); p.feed(get(BIMJ_URL).decode("utf-8", "replace")); p.flush()
    out, seen, year = [], set(), ""
    for t, href, bold in p.blocks:
        t = re.sub(r"\s*\b(PDF|Download)\s*$", "", t)
        y = re.fullmatch(r"(?:Volume \d+,? )?\(?((?:19|20)\d\d)\)?", t)
        if y: year = y.group(1); continue
        if not (20 <= len(t) <= 320) or not EYE_RE.search(t):
            continue
        key = t.lower()[:90]
        if key in seen: continue
        seen.add(key)
        title = bold if len(bold) >= 15 and EYE_RE.search(bold) else t
        title = re.sub(r"^\s*\d+\s*[-–]\s*", "", title)
        title = re.sub(r"^(Original Article|Case Reports?|Review Article|Reviews?|Images? of Interest|Short Communication|Brief Report|Editorial|Letters? to the Editor|Commentary|Clinical Audit)\s*[:-]?\s*", "", title, flags=re.I).strip().rstrip(".")
        url = urllib.parse.urljoin(BIMJ_URL, href) if href else BIMJ_URL
        yu = re.search(r"BIMJ[_-]?((?:19|20)\d\d)", url)
        yr = year or (yu.group(1) if yu else "")
        out.append({"t": title, "src": "Brunei Int Med J", "d": yr, "url": url})
    return out[:6]

def main():
    try:
        data = json.load(open(OUT))
    except Exception:
        data = {}
    status = {}
    for key, fn in (("news", news), ("sea", sea), ("bimj", bimj)):
        try:
            items = fn()
            status[key] = f"ok ({len(items)})"
            if items:
                data[key] = {"items": items, "updated": NOW.date().isoformat()}
        except Exception as e:
            status[key] = f"failed: {e.__class__.__name__}: {e}"[:200]
    data["checked"] = NOW.isoformat(timespec="minutes")
    data["status"] = status
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(json.dumps(status, indent=1))

if __name__ == "__main__":
    main()
