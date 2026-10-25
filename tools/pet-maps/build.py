"""Build Pet Soul Tracker's map pictures and spawn points from aion2timers.com.

    python3 -I tools/pet-maps/build.py [--size 2048]

aion2timers.com's interactive map publishes, under /map/data/:
  maps.json            each map: id (the game's map id, as `21 36` sends it),
                       image size, tiles, and its bounds in world units
                       (px = (X - minX) / (maxX - minX) * width; no flips)
  tiles/<id>/{z}/{x}_{y}.webp   256 px tiles; level z is 256 * 2^z px wide
  positions/<id>.json  spawn groups: entity (an NPC id for monsters) and
                       positions [x, y, x, y, ...] in world units
For each open-world map this writes plugins/pet-souls/maps/<id>.webp, one
picture `--size` px wide stitched from the tiles, and plugins/pet-souls/maps.js:
PET_MAPS (each map's name, picture and bounds) and PET_SPAWNS (each map's
spawn points of the monsters sources.js says drop souls, in metres).
Downloads are kept in tools/pet-maps/cache/ and fetched once, 0.3 s apart.
"""
import argparse
import io
import json
import math
import os
import re
import sys
import time
import urllib.request

from PIL import Image

BASE = "https://www.aion2timers.com/map/data/"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
PLUGIN = os.path.join(REPO, "plugins", "pet-souls")
CACHE = os.path.join(HERE, "cache")
UA = "A2Tools Pet Soul Tracker map build (personal use)"
GROUPS = {"elyos", "asmodian", "abyss"}


def fetch(path):
    """A file under BASE, from the cache when there."""
    local = os.path.join(CACHE, path)
    if os.path.exists(local):
        with open(local, "rb") as f:
            return f.read()
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    os.makedirs(os.path.dirname(local), exist_ok=True)
    with open(local, "wb") as f:
        f.write(data)
    time.sleep(0.3)
    return data


def stitch(m, size):
    """The map's picture `size` px wide, from the tile level nearest above it."""
    img = m["image"]
    z = min(img["max_zoom"], max(0, math.ceil(math.log2(size / 256))))
    scale = 2 ** (img["max_zoom"] - z)
    w, h = math.ceil(img["width"] / scale), math.ceil(img["height"] / scale)
    out = Image.new("RGB", (w, h), (232, 223, 200))
    tile = img["tile_size"]
    for ty in range(math.ceil(h / tile)):
        for tx in range(math.ceil(w / tile)):
            path = m["tiles"].replace("{z}", str(z)).replace("{x}", str(tx)).replace("{y}", str(ty))
            try:
                part = Image.open(io.BytesIO(fetch(path))).convert("RGB")
            except Exception as e:  # a tile past the coast may be missing
                print(f"  no tile {path}: {e}", file=sys.stderr)
                continue
            out.paste(part, (tx * tile, ty * tile))
    width = min(size, w)
    return out.resize((width, round(h * width / w)), Image.LANCZOS) if width != w else out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=2048)
    args = ap.parse_args()
    with open(os.path.join(PLUGIN, "sources.js"), encoding="utf-8") as f:
        sources = f.read()
    soul_npcs = {int(x) for x in re.findall(r'"npcId": (\d+)', sources)}
    catalog = json.loads(fetch("maps.json"))
    maps, spawns = {}, {}
    os.makedirs(os.path.join(PLUGIN, "maps"), exist_ok=True)
    for m in catalog["maps"]:
        if m.get("group") not in GROUPS or not m.get("has_tiles") or m.get("flip", {}).get("x") or m.get("flip", {}).get("y"):
            continue
        print(f"{m['id']} {m['name']}")
        pic = stitch(m, args.size)
        pic.save(os.path.join(PLUGIN, "maps", f"{m['id']}.webp"), "WEBP", quality=78, method=6)
        b = m["bounds"]
        maps[m["id"]] = {"name": m["name"], "w": pic.width, "h": pic.height,
                         "bounds": [b["minX"], b["minY"], b["maxX"], b["maxY"]]}
        pos = json.loads(fetch(m["data"]))
        here = {}
        for g in pos.get("groups", []):
            e = g.get("entity") or {}
            if e.get("mainCategoryId") != "npcs" or not str(e.get("id", "")).isdigit():
                continue
            npc = int(e["id"])
            if npc not in soul_npcs:
                continue
            p = g.get("positions") or []
            here.setdefault(npc, []).extend(round(v / 100) for v in p)
        if here:
            spawns[m["id"]] = here
    with open(os.path.join(PLUGIN, "maps.js"), "w", encoding="utf-8") as f:
        f.write("// The maps Around you draws on, and where the monsters that drop souls spawn.\n")
        f.write(f"// From aion2timers.com's interactive map (build {catalog.get('build')}), by\n")
        f.write("// tools/pet-maps/build.py: don't edit by hand. PET_MAPS: each map id's name,\n")
        f.write("// picture (maps/<id>.webp, w x h px) and bounds [minX, minY, maxX, maxY] in\n")
        f.write("// world units (cm); PET_SPAWNS: map id -> NPC id -> [x, y, x, y, ...] in metres.\n")
        f.write("const PET_MAPS = " + json.dumps(maps, separators=(",", ":")) + ";\n")
        f.write("const PET_SPAWNS = " + json.dumps(spawns, separators=(",", ":")) + ";\n")
    # The pictures as <img> tags in the page: on Linux the meter inlines only
    # the files the page's HTML names (WebKitGTK refuses a plugin frame's own
    # requests), so a picture loaded from script never comes.
    # In both pages that draw the map: the window and the pop-out.
    for name in ("index.html", "widget.html"):
        page = os.path.join(PLUGIN, name)
        with open(page, encoding="utf-8") as f:
            html = f.read()
        start, end = "<!-- map pictures -->", "<!-- /map pictures -->"
        tags = "".join(f'\n      <img class="mapPic" data-map="{i}" src="maps/{i}.webp" alt="" />' for i in maps)
        html = re.sub(re.escape(start) + ".*?" + re.escape(end), start + tags + "\n      " + end, html, flags=re.S)
        with open(page, "w", encoding="utf-8") as f:
            f.write(html)
    print(f"{len(maps)} maps, spawns on {len(spawns)}: {sum(len(v) for s in spawns.values() for v in s.values()) // 2} points")


main()
