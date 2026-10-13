// Pet Soul Tracker: souls still needed to raise each pet.
//
// The game sends every pet's level and soul points once, at login (decoder
// "pet-list"), then each soul as it is picked up ("soul-gained") and each
// level reached ("level-up"). The counts are kept per character, so they
// survive restarts; logging in again resyncs them from the game.

// Souls a pet needs to go from level N to N + 1. The first is inferred: 26
// pets at level 0 held 1 to 4 souls, none 5 or more.
const NEEDED = [5, 25, 75];
const MAX_LEVEL = NEEDED.length;
// Souls from the start of each level to level 3: [105, 100, 75].
const TO_MAX = NEEDED.map((_, level) => NEEDED.slice(level).reduce((n, x) => n + x, 0));

const els = {
  search: document.querySelector(".search"),
  status: document.querySelector(".status"),
  summary: document.querySelector(".summary"),
  hideMax: document.querySelector(".hideMax"),
  genus: document.querySelector(".genus"),
  levels: document.querySelector(".levels"),
  head: document.querySelector(".head"),
  list: document.querySelector(".pets"),
  empty: document.querySelector(".empty"),
};

const empty = () => ({ levels: {}, points: {}, syncedAt: 0 });
let key = null; // storage key of the character shown
let state = empty();
let names = {};
let language = "en";
// How the list is sorted, and whether maxed pets show; kept across restarts.
let prefs = { sort: "left", desc: false, hideMax: true, genus: "", level: "" };
const GENUS_ORDER = ["cogni", "fera", "natura", "varian"];

const savePrefs = () => a2.storage.set("prefs", prefs).catch(() => {});

// The game's name in the meter's language, then English; the user's own name wins.
const gameName = (id) => PET_NAMES[id]?.[language] || PET_NAMES[id]?.en || `Pet #${id}`;
const petName = (id) => names[id] || gameName(id);
const genusName = (genus) => GENUS_NAMES[genus]?.[language] || GENUS_NAMES[genus]?.en || genus;

const SORTS = {
  level: (a, b) => a.level - b.level,
  name: (a, b) => a.name.localeCompare(b.name, language),
  progress: (a, b) => a.progress - b.progress,
  // Pets already at level 3 sort after every pet still to raise.
  left: (a, b) => a.rank - b.rank,
};

function render() {
  const ids = new Set([...Object.keys(state.levels), ...Object.keys(state.points)]);
  // Special pets come at their highest level and take no souls, so they are
  // left out. A pet missing from PET_GENUS (newer than this plugin) stays in.
  const pets = [...ids].filter((id) => PET_GENUS[id] !== "special").map((id) => {
    const level = state.levels[id] || 0;
    const points = state.points[id] || 0;
    const target = NEEDED[level];
    return {
      id,
      level,
      points,
      target,
      name: petName(id),
      genus: PET_GENUS[id] || "",
      progress: target ? points / target : 1,
      // The goal is level 3, so this counts every soul still needed to get there.
      left: target === undefined ? 0 : Math.max(0, TO_MAX[level] - points),
      rank: target === undefined ? Infinity : Math.max(0, TO_MAX[level] - points),
    };
  });
  const open = pets.filter((p) => p.level < MAX_LEVEL);
  const souls = open.reduce((n, p) => n + p.left, 0);
  els.summary.textContent = pets.length
    ? `${open.length} of ${pets.length} pets still to reach level 3 · ${souls} souls to go`
    : "";
  els.status.textContent = state.syncedAt
    ? `Synced at login, ${new Date(state.syncedAt).toLocaleString()}`
    : "Log in to a character (or relog) to read your pets.";

  // A search matches the shown name, the English one or the id.
  const query = els.search.value.trim().toLocaleLowerCase();
  const matches = (p) =>
    !query ||
    p.name.toLocaleLowerCase().includes(query) ||
    (PET_NAMES[p.id]?.en || "").toLowerCase().includes(query) ||
    p.id === query;
  const sort = SORTS[prefs.sort] || SORTS.left;
  const dir = prefs.desc ? -1 : 1;
  // Picking level 3 shows those pets even while they are otherwise hidden.
  const listed = els.hideMax.checked && prefs.level !== String(MAX_LEVEL) ? open : pets;
  const ofGenus = (p) => !prefs.genus || p.genus === prefs.genus;
  const ofLevel = (p) => !prefs.level || String(Math.min(p.level, MAX_LEVEL)) === prefs.level;
  renderChips(els.genus, "genus", listed.filter(ofLevel), (p) => p.genus,
    GENUS_ORDER.map((g) => [g, genusName(g)]));
  // The level row counts every pet, level 3 included, so it shows how far along each level is.
  renderChips(els.levels, "level", pets.filter(ofGenus),
    (p) => String(Math.min(p.level, MAX_LEVEL)),
    NEEDED.map((_, l) => [String(l), `Lv ${l}`]).concat([[String(MAX_LEVEL), `Lv ${MAX_LEVEL}`]]));
  const shown = listed
    .filter(ofGenus)
    .filter(ofLevel)
    .filter(matches)
    .sort((a, b) => dir * sort(a, b) || a.rank - b.rank || a.id - b.id);

  for (const button of els.head.querySelectorAll("button")) {
    const active = button.dataset.sort === prefs.sort;
    button.classList.toggle("active", active);
    button.dataset.dir = active ? (prefs.desc ? "desc" : "asc") : "";
    button.setAttribute("aria-sort", active ? (prefs.desc ? "descending" : "ascending") : "none");
  }
  els.empty.hidden = !(pets.length && !shown.length);

  els.list.replaceChildren(
    ...shown.map((p) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = p.name;
      name.title = `${p.name} (double-click to rename)`;
      name.addEventListener("dblclick", () => rename(p.id, name));
      const level = document.createElement("span");
      level.className = "level";
      level.textContent = p.level >= MAX_LEVEL ? "MAX" : `Lv ${p.level}`;
      const bar = document.createElement("span");
      bar.className = "bar";
      const fill = document.createElement("span");
      fill.style.width = `${Math.min(100, p.progress * 100)}%`;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = p.target ? `${p.points}/${p.target}` : "";
      bar.append(fill, count);
      const left = document.createElement("span");
      left.className = "left";
      left.textContent = p.target ? String(p.left) : "";
      left.title = p.target ? `${p.left} souls to level 3` : "";
      li.append(level, name, bar, left);
      return li;
    }),
  );
}

// A filter row (genus or level): All, then each choice with how many of
// `pets` it holds, given the other filters.
function renderChips(row, pref, pets, valueOf, choices) {
  const counts = {};
  for (const p of pets) counts[valueOf(p)] = (counts[valueOf(p)] || 0) + 1;
  const chip = (value, label, count) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.value = value;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `(${count})`;
    b.append(label, " ", n);
    b.setAttribute("aria-pressed", String(prefs[pref] === value));
    return b;
  };
  row.dataset.pref = pref;
  row.replaceChildren(
    chip("", "All", pets.length),
    ...choices.map(([value, label]) => chip(value, label, counts[value] || 0)),
  );
}

// The sandbox allows no dialogs, so the name is edited in place.
function rename(id, span) {
  const input = document.createElement("input");
  input.className = "rename";
  input.value = names[id] || "";
  input.placeholder = gameName(id);
  input.maxLength = 40;
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    if (keep) {
      if (input.value.trim()) names[id] = input.value.trim();
      else delete names[id];
      a2.storage.set("names", names).catch(() => {});
    }
    render();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
  span.replaceWith(input);
  input.focus();
}

// What each event does to a character's counts.
const handle = {
  "decoded:pet-list"(st, data) {
    st.levels = {};
    st.points = {};
    st.syncedAt = Date.now();
    for (const { pet, level } of data.levels || []) st.levels[pet] = level;
    for (const { pet, points } of data.points || []) st.points[pet] = points;
  },
  "decoded:soul-gained"(st, { pet, amount }) {
    st.points[pet] = (st.points[pet] || 0) + amount;
  },
  "decoded:level-up"(st, { pet, level }) {
    // The game resets a pet's points as it levels (Karnif: 25 -> 0).
    st.levels[pet] = level;
    st.points[pet] = 0;
  },
};

// Counts are kept per character. Each event comes stamped with who was
// playing when it happened, so a login on another character starts that
// character's list rather than overwriting this one.
const keyFor = (character) =>
  character?.name
    ? `char-${character.serverId || 0}-${encodeURIComponent(character.name)}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64)
    : null;
const loaded = new Map();
const load = async (k) => {
  if (!loaded.has(k)) loaded.set(k, (await a2.storage.get(k).catch(() => null)) || empty());
  return loaded.get(k);
};
// When the meter doesn't know who is playing: the character seen last.
const fallbackKey = async () => key || (await a2.storage.get("last").catch(() => null)) || "char-default";
const show = async (k) => {
  key = k;
  state = await load(k);
  render();
};

// Events are handled one at a time, in order (loading a character's counts waits on storage).
let chain = Promise.resolve();
const queued = (fn) => {
  chain = chain.then(fn).catch((e) => console.error(e));
};

for (const event of Object.keys(handle)) {
  a2.on(event, (data, meta) => queued(async () => {
    const k = keyFor(meta?.character) || (await fallbackKey());
    const st = await load(k);
    handle[event](st, data);
    await a2.storage.set(k, st).catch(() => {});
    await a2.storage.set("last", k).catch(() => {});
    if (k !== key) await show(k);
    else render();
  }));
}
// Who is playing as the window opens.
a2.on("character", (character) => queued(async () => {
  await show(keyFor(character) || (await fallbackKey()));
}));
a2.on("language", (code) => {
  language = typeof code === "string" ? code : "en";
  render();
});
// The window's fold button: the list (and its column headers) only.
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));
els.search.addEventListener("input", render);
for (const row of [els.genus, els.levels]) {
  row.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-value]");
    if (!button) return;
    prefs[row.dataset.pref] = button.dataset.value;
    savePrefs();
    render();
  });
}
els.hideMax.addEventListener("change", () => {
  prefs.hideMax = els.hideMax.checked;
  savePrefs();
  render();
});
// A column's button sorts by it; pressing it again reverses the order.
els.head.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-sort]");
  if (!button) return;
  const sort = button.dataset.sort;
  prefs.desc = prefs.sort === sort ? !prefs.desc : false;
  prefs.sort = sort;
  savePrefs();
  render();
});

(async () => {
  names = (await a2.storage.get("names").catch(() => null)) || {};
  prefs = { ...prefs, ...((await a2.storage.get("prefs").catch(() => null)) || {}) };
  els.hideMax.checked = prefs.hideMax;
  await a2.ready();
  // Without a character from the meter, show the last one tracked.
  queued(async () => { if (!key) await show(await fallbackKey()); });
})();
