"""Download free-licensed photos from Wikimedia Commons with their credits.
Usage: python3 fetch_photos.py OUTDIR "File:A.jpg" "File:B.jpg" ...
Only files under CC0, public domain, CC BY or CC BY-SA are saved."""
import json, os, re, sys, urllib.parse, urllib.request

UA = "MataKitaniBot/1.0 (https://infosihatbn.github.io)"
OK = re.compile(r"^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]\d)", re.I)

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def text(h):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", h or "")).strip()

out, titles = sys.argv[1], sys.argv[2:]
os.makedirs(out, exist_ok=True)
cred_path = os.path.join(out, "credits.json")
credits = json.load(open(cred_path)) if os.path.exists(cred_path) else {}
for t in titles:
    q = {"action": "query", "titles": t, "prop": "imageinfo", "iiprop": "url|extmetadata|size",
         "iiurlwidth": "1400", "format": "json"}
    j = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q)))
    page = next(iter(j["query"]["pages"].values()))
    if "imageinfo" not in page:
        print("MISSING", t); continue
    ii = page["imageinfo"][0]; md = ii.get("extmetadata", {})
    lic = text(md.get("LicenseShortName", {}).get("value"))
    if not OK.search(lic):
        print("SKIP licence", lic, t); continue
    slug = re.sub(r"[^a-z0-9]+", "-", t.split(":", 1)[1].rsplit(".", 1)[0].lower()).strip("-")[:60] + ".jpg"
    open(os.path.join(out, slug), "wb").write(get(ii.get("thumburl") or ii["url"]))
    credits[slug] = {"title": t, "author": text(md.get("Artist", {}).get("value")), "licence": lic,
                     "licence_url": md.get("LicenseUrl", {}).get("value", ""), "source": ii["descriptionurl"],
                     "desc": text(md.get("ImageDescription", {}).get("value"))[:200], "size": [ii["width"], ii["height"]]}
    print("OK", slug, lic)
json.dump(credits, open(cred_path, "w"), indent=1, ensure_ascii=False)
