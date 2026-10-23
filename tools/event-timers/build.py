"""Build Event Timers' schedule.js from AION 2's own game data.

    python tools/event-timers/build.py --tables <...>/AION2/Content/Data/Table [--tw-l10n <...>/L10N]

The tables are the client's, extracted to JSON (the same extract as
tools/game-souls). What comes from them:
  EventSchedule   field events by weekday and start times (ActiveTimeList),
                  each naming an EventGroup of FieldEvent rows
  FieldEvent      the group's events: kind, map, ReadyDuration + ProgressTime
  PeriodSpawn     field bosses and rift portals on a schedule: first time,
                  Cycle (minutes, 0 = once that day) and weekdays
  RiftData        a rift portal's LifeTime (seconds)
  NpcData/Map     names; Map.json + MapData spawners for which boss a
                  spawner holds
  ItemGetRoute    which maps are open (as in tools/game-souls)
  WorldMapFieldNamed  the field bosses that respawn a while after each kill
                  (SpawnType Basic): their timers come from the feed players'
                  meters share (a2.bossTimers), keyed by this table's ID
--servers takes the meter's src/data/servers.json, for the servers' names.
Times are server time; the plugin turns them into the player's own clock
from their server's region. Writes plugins/event-timers/schedule.js.
"""
import argparse
import json
import os
import sys
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LANG_DIRS = {"en": "en-US", "ko": "ko-KR", "ja": "ja-JP", "de": "de-DE", "fr": "fr-FR",
             "es": "es-ES", "pt": "pt-BR", "ru": "ru-RU"}
TICKS_PER_MIN = 600_000_000

# The game's own words for each event's name, where it has one.
TITLE_KEYS = {
    "festival": "InputKeyMapping_UI_ShugoFesta_desc",
    "invasion": "Post_10120101_sender_name",
    "artifact": "String_UI_ARTIFACTWAR_HUD_EVENT_TITLE_body",
}
# No plain string in the client for these: the plugin's own, in every language.
OWN_TEXT = {
    "rift": {"en": "Spacetime Rift", "ko": "시공의 균열", "ja": "時空の亀裂", "de": "Raum-Zeit-Riss",
             "fr": "Faille spatio-temporelle", "es": "Grieta espaciotemporal", "pt": "Fenda Espaço-Temporal",
             "ru": "Пространственно-временной разлом", "zh-Hant": "時空裂縫", "zh-Hans": "时空裂缝"},
    "daily": {"en": "Daily reset", "ko": "일일 초기화", "ja": "デイリーリセット", "de": "Täglicher Reset",
              "fr": "Réinitialisation quotidienne", "es": "Reinicio diario", "pt": "Reinício diário",
              "ru": "Ежедневный сброс", "zh-Hant": "每日重置", "zh-Hans": "每日重置"},
    "weekly": {"en": "Weekly reset", "ko": "주간 초기화", "ja": "ウィークリーリセット", "de": "Wöchentlicher Reset",
               "fr": "Réinitialisation hebdomadaire", "es": "Reinicio semanal", "pt": "Reinício semanal",
               "ru": "Еженедельный сброс", "zh-Hant": "每週重置", "zh-Hans": "每周重置"},
}
DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def v(x):
    return x["Value"] if isinstance(x, dict) else x


def load(t, name):
    with open(os.path.join(t, name), encoding="utf-8") as f:
        d = json.load(f)["Properties"]["Data"]
    return d if isinstance(d, list) else list(d.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tables", default=os.environ.get("A2_GAME_TABLES", ""))
    ap.add_argument("--tw-l10n", default=None, help="the Taiwan client's extracted Table/L10N folder (zh-TW)")
    ap.add_argument("--servers", default=None, help="the meter's src/data/servers.json, for server names")
    ap.add_argument("--out", default=os.path.join(REPO, "plugins", "event-timers", "schedule.js"))
    a = ap.parse_args()
    T = a.tables
    if not T or not os.path.isdir(T):
        sys.exit("--tables: the extracted Data/Table folder (or set A2_GAME_TABLES)")

    langs = {}
    for code, folder in LANG_DIRS.items():
        with open(os.path.join(T, "L10N", folder, "L10NString.json"), encoding="utf-8") as f:
            langs[code] = json.load(f)["Entries"]
    if a.tw_l10n:
        with open(os.path.join(a.tw_l10n, "zh-TW", "L10NString.json"), encoding="utf-8") as f:
            langs["zh-Hant"] = json.load(f)["Entries"]
    en = langs["en"]
    text = {}

    def tk(key):
        """A text key: the client's string, in each language that has its own."""
        k = key if key in en else "String_" + key + "_body"
        if k not in en:
            sys.exit(f"no string {key}")
        if k not in text:
            t = {"en": en[k]}
            for code, e in langs.items():
                x = e.get(k)
                if code != "en" and x and x != k and x != en[k]:
                    t[code] = x
            text[k] = t
        return k

    def own(name):
        k = "=" + name
        text[k] = dict(OWN_TEXT[name])
        return k

    maps = {v(r["ID"]): r for r in load(T, "Map.json")}
    npcs = {v(r["ID"]): r for r in load(T, "NpcData.json")}
    groups = defaultdict(list)
    for r in load(T, "FieldEvent.json"):
        groups[r["EventGroup"]].append(r)
    rifts = {r["Name"]: r for r in load(T, "RiftData.json")}

    # Open maps, as tools/game-souls decides them: the fields the game's
    # "where to get it" monster routes name.
    live = set()
    for r in load(T, "ItemGetRoute.json"):
        for m in r.get("MonsterGetRoutes", []):
            live.add(v(m["RegionInfo"]["MapId"]))

    # Which boss each spawner holds, from the maps' spawn data.
    data_dir = os.path.dirname(os.path.normpath(T))
    spawner_npc = {}
    for root, _, files in os.walk(os.path.join(data_dir, "Map")):
        if "MapData.json" in files:
            with open(os.path.join(root, "MapData.json"), encoding="utf-8") as f:
                md = json.load(f)["Properties"]["Data"]
            for sp in md["SpawnInfoList"]:
                if sp["NpcIdList"]:
                    spawner_npc[sp["Name"]] = v(sp["NpcIdList"][0])

    def map_text(mid):
        return tk(maps[mid]["Desc"]["Key"])

    def days_of(r):
        return [i for i, d in enumerate(DAYS) if r.get("b" + d)]

    def minutes(ticks):
        return int(ticks // TICKS_PER_MIN)

    events = []

    # Field events: the Shugo Festival (every hour, one random game) and the
    # Dimensional Invasion, per faction; the Artifact Siege.
    for r in load(T, "EventSchedule.json"):
        starts = sorted(minutes(t["Ticks"]) for t in r["ActiveTimeList"])
        for e in r["EventList"]:
            key = e.get("Key", "")
            rows = groups.get(key, [])
            if key.startswith(("Group_Light_", "Group_Dark_")):
                side = "elyos" if key.startswith("Group_Light_") else "asmodian"
                kind = "invasion" if key.endswith("_Invasion") else "festival"
                field = 1010 if side == "elyos" else 1110
                window = max((x["ReadyDuration"] + x["ProgressTime"]) for x in rows) // 60 if rows else 0
                # How long after the start it can be entered (ReadyDuration,
                # seconds): the game closes the entrance then.
                enter = min(x["ReadyDuration"] for x in rows) if rows else 0
                ev = {"id": f"{kind}-{side}", "kind": "event", "name": tk(TITLE_KEYS[kind]),
                      "where": [map_text(field)], "side": side, "days": days_of(r),
                      "starts": starts, "minutes": window, "enter": enter}
                # Eleven festival groups share one schedule (the game picks one
                # game an hour): keep one entry per side.
                if not any(x["id"] == ev["id"] for x in events):
                    events.append(ev)
            elif key == "abyss_ar1_artifactwar" and 20 in live:
                events.append({"id": "artifact", "kind": "event", "name": tk(TITLE_KEYS["artifact"]),
                               "where": [map_text(20)], "side": None, "days": days_of(r),
                               "starts": starts, "minutes": 0})

    # Scheduled field bosses and rift portals.
    bosses = defaultdict(lambda: {"names": [], "where": set()})
    rift_maps = set()
    rift_cycle = None
    for r in load(T, "PeriodSpawn.json"):
        mid = v(r["MapId"])
        if mid not in live:
            continue
        first = minutes(r["Time"]["Ticks"])
        cycle = r["Cycle"]
        starts = list(range(first, 24 * 60, cycle)) if cycle else [first]
        if "RiftPortal" in r["Name"]:
            rift_maps.add(mid)
            rift_cycle = (tuple(starts), tuple(days_of(r)))
            continue
        npc = npcs.get(spawner_npc.get(r["SpawnerName"]))
        if not npc:
            continue
        slot = bosses[(tuple(starts), tuple(days_of(r)))]
        name = tk(npc["Desc"]["Key"])
        if name not in slot["names"]:
            slot["names"].append(name)
        slot["where"].add(mid)
    for (starts, days), slot in bosses.items():
        events.append({"id": "boss-" + "-".join(text[n]["en"].split()[-1].lower() for n in slot["names"]),
                       "kind": "boss", "name": slot["names"][0], "also": slot["names"][1:],
                       "where": [map_text(m) for m in sorted(slot["where"])], "side": None,
                       "days": list(days), "starts": list(starts), "minutes": 0})
    if rift_cycle:
        life = max((x["LifeTime"] for n, x in rifts.items() if "RiftPortal" in n and x["ArrivalMapId"]), default=0)
        events.append({"id": "rift", "kind": "event", "name": own("rift"),
                       "where": [map_text(m) for m in sorted(rift_maps)], "side": None,
                       "days": list(rift_cycle[1]), "starts": list(rift_cycle[0]), "minutes": life // 60})
        # No Dimensional Invasion while a Spacetime Rift is on: the tables list
        # one every hour at :30, but in a rift's hour (02:00, 05:00, 08:00,
        # 11:00... server time) none starts (a player, 2026-10-24).
        rift_hours = {start // 60 for start in rift_cycle[0]}
        for ev in events:
            if ev["id"].startswith("invasion-"):
                ev["starts"] = [start for start in ev["starts"] if start // 60 not in rift_hours]

    # Resets: one moment on every Global server, 16:00 Korean time (07:00 UTC).
    events.append({"id": "daily", "kind": "reset", "name": own("daily"), "where": [], "side": None,
                   "days": list(range(7)), "starts": [7 * 60], "minutes": 0, "utc": True})
    events.append({"id": "weekly", "kind": "reset", "name": own("weekly"), "where": [], "side": None,
                   "days": [3], "starts": [7 * 60], "minutes": 0, "utc": True})

    # Field bosses that respawn after each kill, on open maps: their timers
    # come from players' meters (a2.bossTimers), keyed by world-map id.
    race = {"ERace::Light": "elyos", "ERace::Dark": "asmodian"}
    field = {}
    for r in load(T, "WorldMapFieldNamed.json"):
        mid = v(r["MapId"])
        if not r["SpawnType"].endswith("::Basic") or mid not in live:
            continue
        npc = npcs.get(spawner_npc.get(r["FieldNamedSpawnerName"]))
        if not npc:
            continue
        field[str(v(r["ID"]))] = {"name": tk(npc["Desc"]["Key"]), "where": map_text(mid),
                                  "side": race.get(maps[mid].get("MapRace")), "level": npc.get("Level") or None}

    # Global servers' names, in each language the meter has them in.
    servers = {}
    if a.servers:
        with open(a.servers, encoding="utf-8") as f:
            for sid, names in json.load(f)["servers"].items():
                if len(sid) == 4 and sid[1] in "12345":
                    servers[sid] = {k: n for k, n in names.items() if n and (k == "en" or n != names.get("en"))}

    try:
        import opencc
        t2s = opencc.OpenCC("t2s").convert
        for t in text.values():
            if "zh-Hant" in t and "zh-Hans" not in t:
                t["zh-Hans"] = t2s(t["zh-Hant"])
    except ImportError:
        print("opencc missing: no zh-Hans from the game's strings", file=sys.stderr)

    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Recurring events and scheduled bosses, from the game's own tables.\n")
        f.write("// Generated by tools/event-timers/build.py: don't edit by hand.\n")
        f.write("// starts: minutes after midnight, server time (UTC with utc: true);\n")
        f.write("// days: 0 = Sunday; minutes: how long it runs, 0 if the tables don't say.\n")
        f.write("const EVENTS = " + json.dumps(events, ensure_ascii=False, indent=1) + ";\n")
        f.write("// Field bosses that respawn after each kill, by world-map id: their timers\n")
        f.write("// come from the feed players' meters share (a2.bossTimers).\n")
        f.write("const FIELD_BOSSES = " + json.dumps(field, ensure_ascii=False, indent=1, sort_keys=True) + ";\n")
        f.write("// Global servers' names, by server id, in each language that differs.\n")
        f.write("const SERVERS = " + json.dumps(servers, ensure_ascii=False, indent=1, sort_keys=True) + ";\n")
        f.write("const EVENT_TEXT = " + json.dumps(text, ensure_ascii=False, indent=1, sort_keys=True) + ";\n")
    print(f"wrote {a.out}: {len(events)} events, {len(field)} field bosses, {len(servers)} servers", file=sys.stderr)
    for e in events:
        times = e["starts"]
        print(f"  {e['id']:28} {text[e['name']]['en'][:26]:26} days={e['days']} "
              f"{len(times)}x from {times[0] // 60:02d}:{times[0] % 60:02d} for {e['minutes']} min",
              file=sys.stderr)


if __name__ == "__main__":
    main()
