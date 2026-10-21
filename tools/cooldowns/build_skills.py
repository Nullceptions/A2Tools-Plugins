"""Build the Cooldowns plugin's skills.js and icons from AION 2's own game data.

    python tools/cooldowns/build_skills.py --tables <...>/Output/AION2/Content/Data/Table
        [--meter <A2Tools-DPS-Meter>] [--cache <folder for downloaded PNGs>]

Reads (client tables under AION2/Content/Data/Table):
  Skill.json          class skills: ESkillType::Active rows keyed STR_SKILL_PC_<CLASS>_,
                      NeedCoolTime > 0, grouped by GroupCoolTimeId (the id the server's
                      cooldown list, 47 38, names); cd from the group's base row
  SkillAbnormal.json  buffs: AbnormalType Buff with bAbnormalIconView
Names come from the meter's own translations (src/data/i18n/skills and
abnormals, by id); buffs have no Chinese, so they fall back to English.

Writes plugins/cooldowns/skills.js (window.COOLDOWN_DATA) and
plugins/cooldowns/icons/<stem>.webp (48 x 48), each icon fetched once from the
game's CDN and kept in --cache. The table cooldowns are the base values: the
plugin learns the real ones (cooldown stats, talents) from the server's lists.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "plugins" / "cooldowns"
LANGS = ["en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"]
CLASSES = {"GLADIATOR": ("11", "GL"), "TEMPLAR": ("12", "TE"), "ASSASSIN": ("13", "AS"), "RANGER": ("14", "RA"),
           "SORCERER": ("15", "SO"), "ELEMENTALIST": ("16", "EL"), "CLERIC": ("17", "CL"), "CHANTER": ("18", "CH"),
           "FIGHTER": ("19", "GT")}
CDN = "https://assets.playnccdn.com/static-aion2-gamedata/resources/"
PROXY = os.environ.get("CDN_PROXY", "http://192.168.0.113:16005")
SIZE = 48


def rows(tables, name):
    return json.loads((tables / name).read_text(encoding="utf-8"))["Properties"]["Data"]


def names(meter, kind):
    out = {}
    for lang in LANGS:
        path = meter / "src" / "data" / "i18n" / kind / f"{lang}.json"
        out[lang] = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    return out


def named(table, key):
    """Every language's name for `key`; English where one is missing."""
    en = table["en"].get(key)
    if not en:
        return None
    n = {}
    for lang in LANGS:
        v = table[lang].get(key) or en
        if lang == "en" or v != en:
            n[lang] = v
    return n


def stem(icon_path):
    return icon_path.rsplit("/", 1)[-1]


def fetch(name, cache):
    raw = cache / f"{name}.png"
    if raw.is_file():
        return raw
    missing = cache / f"{name}.404"
    if missing.is_file():
        return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}) if PROXY else urllib.request.ProxyHandler({}))
    for attempt in range(4):
        try:
            with opener.open(CDN + name + ".png", timeout=12) as r:
                raw.write_bytes(r.read())
                return raw
        except urllib.error.HTTPError as e:
            if e.code == 404:
                missing.write_text("")
                return None
        except Exception:
            pass
        time.sleep(2)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tables", required=True, type=Path)
    ap.add_argument("--meter", type=Path, default=ROOT.parent / "A2Tools-DPS-Meter")
    ap.add_argument("--cache", type=Path, default=Path(os.environ.get("CLAUDE_JOB_DIR", ".")) / "tmp" / "cdicons")
    args = ap.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    skills = rows(args.tables, "Skill.json")
    by_id = {r["ID"]["Value"]: r for r in skills}
    skill_names = names(args.meter, "skills")

    classes = {prefix: {"code": code, "skills": []} for prefix, code in CLASSES.values()}
    groups = {}
    variants = {}
    for r in skills:
        m = re.match(r"STR_SKILL_PC_([A-Z]+)_", r["SkillString_Key"])
        if not m or m.group(1) not in CLASSES or r["SkillType"] != "ESkillType::Active" or not r["NeedCoolTime"]:
            continue
        prefix, _ = CLASSES[m.group(1)]
        sid, group = r["ID"]["Value"], r["GroupCoolTimeId"]
        if not str(group).startswith(prefix):
            continue
        if group != sid - sid % 10000:
            variants[sid] = group
        groups.setdefault((prefix, group), []).append(r)

    icons = set()
    for (prefix, group), members in sorted(groups.items()):
        base = by_id.get(group) or min(members, key=lambda r: r["ID"]["Value"])
        n = (named(skill_names, str(group))
             or next((named(skill_names, str(r["ID"]["Value"])) for r in members if named(skill_names, str(r["ID"]["Value"]))), None)
             or named(skill_names, str(group - group % 10000)))
        if not n:
            print(f"no name: {group}", file=sys.stderr)
            continue
        icon = stem(base["SkillIcon"])
        icons.add(icon)
        classes[prefix]["skills"].append({"g": group, "cd": int(base["NeedCoolTime"] or members[0]["NeedCoolTime"]), "icon": icon, "n": n})

    buff_names = names(args.meter, "abnormals")
    buffs = {}
    for r in rows(args.tables, "SkillAbnormal.json"):
        if r["AbnormalType"] != "EAbnormalType::Buff" or not r["bAbnormalIconView"] or not r["AbnormalIcon"]:
            continue
        n = named(buff_names, str(r["ID"]["Value"]))
        if not n:
            continue
        icon = stem(r["AbnormalIcon"])
        icons.add(icon)
        buffs[str(r["ID"]["Value"])] = {"icon": icon, "n": n}

    # Names repeat a lot among buffs (ranks of one buff): keep each set once.
    texts, index = [], {}
    for b in buffs.values():
        key = json.dumps(b["n"], ensure_ascii=False, sort_keys=True)
        if key not in index:
            index[key] = len(texts)
            texts.append(b["n"])
        b["t"] = index[key]
        del b["n"]

    # Icons
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    # The tables spell some icons two ways (ICON_Abnormal_StatUp / _Statup).
    # Windows sees one file, the CDN and Linux two: every spelling points at
    # the file's own name. have: lowercase name -> file name.
    have, lost = {}, []
    for name in sorted(icons):
        if name.lower() in have:
            continue
        raw = fetch(name, args.cache)
        if not raw:
            lost.append(name)
            continue
        dest = OUT / "icons" / f"{name}.webp"
        if not dest.is_file():
            Image.open(raw).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS).save(dest, "WEBP", quality=80, method=6)
        have[name.lower()] = next(p.stem for p in (OUT / "icons").iterdir() if p.stem.lower() == name.lower())
    for c in classes.values():
        for s in c["skills"]:
            s["icon"] = have.get(s["icon"].lower(), "")
    for b in buffs.values():
        b["icon"] = have.get(b["icon"].lower(), "")

    data = {"classes": classes, "variants": {str(k): v for k, v in sorted(variants.items())}, "buffs": buffs, "buffNames": texts}
    js = ("// Generated by tools/cooldowns/build_skills.py from the game's Skill and\n"
          "// SkillAbnormal tables and the meter's translations. Do not edit.\n"
          "// classes[prefix].skills: g = cooldown group (the id the server's cooldown list uses),\n"
          "// cd = the table's base cooldown in ms, icon = icons/<icon>.webp, n = names.\n"
          "// variants: skill ids whose group isn't id - id % 10000. buffs[abnormal]: t indexes buffNames.\n"
          "window.COOLDOWN_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (OUT / "skills.js").write_text(js, encoding="utf-8")

    print("skills per class:", {c["code"]: len(c["skills"]) for c in classes.values()})
    print("variants (group != id - id % 10000):", len(variants), dict(list(sorted(variants.items()))[:10]))
    print("buffs:", len(buffs), "name sets:", len(texts))
    print("icons:", len(have), "missing:", lost)


if __name__ == "__main__":
    main()
