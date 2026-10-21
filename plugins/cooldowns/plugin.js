// Cooldowns: your skill cooldowns and buffs as icons over the game.
//
// What the game says (decoders in manifest.json; worked out from captures,
// 2026-10-20):
//   01 38  you used a skill: its id (a variant of the skill, e.g. 14060010 for
//          base 14060000; the base is the cooldown's group).
//   47 38  cooldowns: a list of (group, ms left). One entry when something
//          changed a cooldown (a reset reads 0); every group at once now and
//          then. The game works the cooldown out itself, with your cooldown
//          reduction, so nothing says it when a skill is used.
//   2A 38 / 2B 38 / 2C 38  a buff on you added, changed, removed.
//
// So a skill's cooldown starts from the game's base time (skills.js), and is
// replaced by what is measured: when a full list arrives, the time since the
// skill was used plus the time it still has left is its real cooldown (a
// Sorcerer's 60 s skills ran 27.8 s), unless something changed it meanwhile.
// Skills not yet measured scale by how far the measured ones are below base.
const $ = (s) => document.querySelector(s);
const DATA = window.COOLDOWN_DATA || { classes: {}, buffs: {} };
const LANGS = Object.keys(UI);

// Every class skill by its group: { g, cd, icon, n, cls }.
const SKILLS = new Map();
for (const [cls, c] of Object.entries(DATA.classes || {})) {
  for (const s of c.skills || []) SKILLS.set(s.g, { ...s, cls });
}
// The skills a class lists: none under 1.5 s (Dodge, a held skill's later
// stages), and one of each name, the longest (Cold Storm's 8 s and 0.3 s
// follow-ups share its name).
const LISTED = {};
for (const [cls, c] of Object.entries(DATA.classes || {})) {
  const byName = new Map();
  for (const s of c.skills || []) {
    if (s.cd < 1500) continue;
    const name = s.n?.en || s.g;
    const had = byName.get(name);
    if (!had || s.cd > had.cd) byName.set(name, s);
  }
  const keep = new Set(byName.values());
  LISTED[cls] = (c.skills || []).filter((s) => keep.has(s));
}
const listed = (g) => (LISTED[SKILLS.get(g)?.cls] || []).some((s) => s.g === g);

const groupOf = (skill) => {
  const v = DATA.variants && DATA.variants[skill];
  if (v) return v;
  const g = skill - (skill % 10000);
  return SKILLS.has(g) ? g : SKILLS.has(skill) ? skill : null;
};

let lang = "en";
let words = UI.en;
const nameOf = (n) => (n && (n[lang] || n.en)) || "";
const skillName = (g) => nameOf(SKILLS.get(g)?.n) || String(g);
// A buff's names are shared with others of the same name (skills.js).
const buffName = (a) => nameOf(DATA.buffNames?.[DATA.buffs?.[a]?.t]) || `#${a}`;
const buffIcon = (a) => DATA.buffs?.[a]?.icon || "";

// ---- Settings ----------------------------------------------------------

// The look and the alerts, for every character.
const DEFAULTS = {
  show: true, autoAdd: true, ownBuffs: true,
  layout: "combined", size: "42", direction: "right", perLine: 10, opacity: 100,
  numbers: true, readyGlow: true, sound: "chime", voice: false, lead: 3,
  combatOnly: false, combatAfter: 10,
};
let prefs = { ...DEFAULTS };
// What each character shows: { cls, skills: { g: opts }, buffs: { a: opts },
// learned: { g: ms } }, by "name@server".
let charKey = "?";
let mine = { cls: null, skills: {}, buffs: {}, learned: {} };

const save = () => a2.storage.set("prefs", prefs).catch(() => {});
let saving = null;
// Per character, a moment after the last change (casts change it often).
const saveMine = () => {
  clearTimeout(saving);
  saving = setTimeout(() => a2.storage.set(`char:${charKey}`, mine).catch(() => {}), 1500);
};

async function loadCharacter(c) {
  const key = c && c.name ? `${c.name}@${c.serverId ?? ""}` : "?";
  if (key === charKey) return;
  clearTimeout(saving);
  if (charKey !== "?") await a2.storage.set(`char:${charKey}`, mine).catch(() => {});
  const stored = await a2.storage.get(`char:${key}`).catch(() => null);
  // A first character takes what was set up before its name came.
  const carried = charKey === "?" && !stored ? mine : null;
  charKey = key;
  mine = { cls: null, skills: {}, buffs: {}, learned: {}, ...(stored || carried || {}) };
  live.cd.clear();
  live.buffs.clear();
  $(".char").textContent = c && c.name ? c.name : "";
  renderAll();
}

// ---- What is happening -------------------------------------------------

const live = {
  cd: new Map(), // group -> { start, end }
  used: new Map(), // group -> when last used
  // Groups seen ready, or with more time left than they should have, since
  // their last use: used again unannounced (not every use sends 01 38), so
  // that use's time can't be measured.
  unsure: new Set(),
  changed: new Set(), // groups whose cooldown something changed since use
  samples: new Map(), // group -> the last few measured cooldowns
  buffs: new Map(), // instance -> { a, skill, start, end }
  clock: null, // the server's clock minus ours (buff ends are in its time)
};

// How far measured cooldowns are below base: the median ratio.
function reduction() {
  const r = Object.entries(mine.learned)
    .map(([g, ms]) => ms / (SKILLS.get(Number(g))?.cd || 0))
    .filter((x) => Number.isFinite(x) && x > 0 && x <= 1.2)
    .sort((a, b) => a - b);
  return r.length ? r[Math.floor(r.length / 2)] : 1;
}
const cooldownOf = (g) => mine.learned[g] || Math.round((SKILLS.get(g)?.cd || 0) * reduction());

function onSkill(data, at) {
  const g = groupOf(Number(data.skill));
  if (!g) return;
  const s = SKILLS.get(g);
  if (!s.cd) return;
  if (mine.cls !== s.cls) {
    mine.cls = s.cls;
    renderSkills();
  }
  if (!mine.skills[g] && prefs.autoAdd && listed(g)) {
    mine.skills[g] = { show: true };
    renderSkills();
  }
  live.used.set(g, at);
  lastSkillAt = Math.max(lastSkillAt, at);
  if (away) checkAway();
  live.changed.delete(g);
  live.unsure.delete(g);
  live.cd.set(g, { start: at, end: at + cooldownOf(g) });
  saveMine();
  changed();
}

function onCooldowns(data, at) {
  const list = data.skills || [];
  const all = list.length > 1;
  let learnt = false;
  for (const { group, ms } of list) {
    const g = Number(group);
    if (!SKILLS.has(g)) continue;
    const was = live.cd.get(g);
    const used = live.used.get(g);
    if (!ms) {
      if (was && was.end > at) live.cd.set(g, { ...was, end: at });
      if (used) live.unsure.add(g);
    } else {
      // More left than it had: used again without a word.
      if (was && at + ms > was.end + 1000) live.unsure.add(g);
      const start = was && was.end > at && !live.unsure.has(g) ? was.start : at + ms - Math.max(ms, cooldownOf(g));
      live.cd.set(g, { start, end: at + ms });
    }
    if (!all) {
      live.changed.add(g);
      continue;
    }
    // A full list: what is left, plus the time since it was used, is its
    // cooldown, when nothing changed it and it wasn't used again unseen.
    if (!ms || !used || live.changed.has(g) || live.unsure.has(g) || at - used > 10 * 60_000) continue;
    const total = at - used + ms;
    const base = SKILLS.get(g).cd;
    if (total < base * 0.15 || total > base * 1.2) continue;
    const list5 = [...(live.samples.get(g) || []), total].slice(-5);
    live.samples.set(g, list5);
    const median = [...list5].sort((x, y) => x - y)[Math.floor(list5.length / 2)];
    const value = Math.round(median / 50) * 50;
    live.cd.set(g, { start: used, end: at + ms });
    if (mine.learned[g] !== value) {
      mine.learned[g] = value;
      learnt = true;
    }
  }
  if (learnt) {
    saveMine();
    renderSkills();
  }
  changed();
}

const ENDLESS = 1e15;

function onBuffAdded(d, at) {
  if (Number(d.length) >= ENDLESS) return;
  const length = Number(d.length);
  const end = Number(d.end);
  // Its start in the server's clock is the end less its length: now, for a
  // buff just added.
  live.clock = end - length - at;
  const a = Number(d.abnormal);
  const skill = d.flags & 2 ? groupOf(Number(d.skill)) : null;
  live.buffs.set(d.instance, { a, skill, start: at, end: end - live.clock });
  // Only the buffs the game shows (skills.js has those): the rest are its
  // own markers, with no name or icon.
  if (!mine.buffs[a] && DATA.buffs?.[a]) {
    mine.buffs[a] = { show: false, seen: Date.now() };
    if (skill) mine.buffs[a].skill = skill;
    saveMine();
    if (tab === "buffs") renderBuffs();
  }
  changed();
}

function onBuffChanged(d, at) {
  if (Number(d.length) >= ENDLESS || live.clock == null) return;
  const b = live.buffs.get(d.instance);
  const end = Number(d.end) - live.clock;
  if (b) b.end = end;
  else live.buffs.set(d.instance, { a: Number(d.abnormal), skill: null, start: at, end });
  changed();
}

function onBuffRemoved(d, at) {
  // Only the first removal of a record is read; the others run out in time.
  const b = live.buffs.get(d.instance);
  if (b) b.end = Math.min(b.end, at);
  changed();
}

// ---- The icons -------------------------------------------------------------

// The slots each widget shows: skills in the order of the class's list, then
// buffs by when they were first seen.
function slots() {
  const now = Date.now();
  const skills = [];
  const buffs = [];
  const onSkill = new Map(); // group -> its buff, for "both"
  for (const b of live.buffs.values()) {
    if (b.end <= now) continue;
    const o = mine.buffs[b.a];
    if (o?.show) {
      buffs.push({ key: `b${b.a}`, icon: buffIcon(b.a), buffStart: b.start, buffEnd: b.end });
    } else if (prefs.ownBuffs && b.skill && (!o || o.show !== false || o.skill)) {
      const cur = onSkill.get(b.skill);
      if (!cur || cur.end < b.end) onSkill.set(b.skill, b);
    }
  }
  const order = (LISTED[mine.cls] || []).map((s) => s.g);
  for (const g of order) {
    const o = mine.skills[g];
    if (!o?.show) continue;
    const c = live.cd.get(g);
    const b = onSkill.get(g);
    skills.push({
      key: `s${g}`, icon: SKILLS.get(g).icon, always: !!o.always,
      cdStart: c?.start || 0, cdEnd: c?.end || 0,
      buffStart: b?.start || 0, buffEnd: b?.end || 0,
    });
  }
  return { skills, buffs };
}

// A widget's window: its icons laid out in lines of `perLine`.
function sizeFor(count) {
  const s = Number(prefs.size);
  const gap = Math.round(s * 0.08) + 2;
  const n = Math.max(1, count);
  const along = Math.min(n, prefs.perLine);
  const across = Math.ceil(n / prefs.perLine);
  const vertical = prefs.direction === "down" || prefs.direction === "up";
  const w = (vertical ? across : along) * (s + gap) + gap + 8;
  const h = (vertical ? along : across) * (s + gap) + gap + 8;
  return { width: Math.min(800, w), height: Math.min(800, h) };
}

let gameOpen = false;
// Out of combat: no skill of yours for `combatAfter` seconds. The meter has
// no combat state for plugins; your own skills are the sign this plugin reads.
let lastSkillAt = 0;
let away = false;
function checkAway() {
  const now = prefs.combatOnly && Date.now() - lastSkillAt > prefs.combatAfter * 1000;
  if (now === away) return;
  away = now;
  send();
}
const widgetsWanted = () => prefs.show && gameOpen;
let openNow = new Set();
let lastSizes = "";

// The widgets' windows sized for every icon that may show (a skill set to
// show, a buff set to show), so nothing moves as cooldowns come and go.
async function placeWidgets() {
  const want = new Map();
  if (widgetsWanted()) {
    const skills = Object.values(mine.skills).filter((o) => o.show).length;
    const buffs = Object.values(mine.buffs).filter((o) => o.show).length;
    if (prefs.layout === "split") {
      if (skills) want.set("skills", sizeFor(skills));
      if (buffs) want.set("buffs", sizeFor(buffs));
    } else if (skills + buffs) {
      want.set("bar", sizeFor(skills + buffs));
    }
  }
  const sizes = JSON.stringify([...want]);
  if (sizes !== lastSizes) {
    lastSizes = sizes;
    for (const name of openNow) if (!want.has(name)) await a2.widgets.close(name).catch(() => {});
    for (const [name, size] of want) await a2.widgets.open(name, size).catch(() => {});
    openNow = new Set(want.keys());
  }
  send();
}

function send() {
  if (!openNow.size) return;
  const { skills, buffs } = slots();
  const look = { size: Number(prefs.size), direction: prefs.direction, perLine: prefs.perLine, opacity: prefs.opacity / 100, numbers: prefs.numbers, readyGlow: prefs.readyGlow, away };
  if (openNow.has("bar")) a2.widgets.send("bar", { look, slots: [...skills, ...buffs] }).catch(() => {});
  if (openNow.has("skills")) a2.widgets.send("skills", { look, slots: skills }).catch(() => {});
  if (openNow.has("buffs")) a2.widgets.send("buffs", { look, slots: buffs }).catch(() => {});
}

// A change: the icons now, and soon again (several records come together).
let sendSoon = null;
function changed() {
  if (sendSoon) return;
  sendSoon = setTimeout(() => {
    sendSoon = null;
    send();
  }, 60);
}

// ---- Alerts ------------------------------------------------------------

function speak(text) {
  if (!prefs.voice || !text || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().split("-")[0]));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
const ding = () => prefs.sound !== "off" && typeof playSound === "function" && playSound(prefs.sound);

// What has alerted, so each alerts once: "g:<end>", "b:<instance>:<end>".
const alerted = new Set();
setInterval(() => {
  const now = Date.now();
  let any = false;
  for (const [g, c] of live.cd) {
    if (c.end > now || now - c.end > 3000) continue;
    const key = `g:${g}:${c.end}`;
    if (alerted.has(key)) continue;
    alerted.add(key);
    any = true;
    const o = mine.skills[g];
    if (o?.sound) ding();
    if (o?.voice) speak(skillName(g));
  }
  const lead = prefs.lead * 1000;
  for (const [instance, b] of live.buffs) {
    if (b.end <= now) {
      if (now - b.end > 60_000) live.buffs.delete(instance);
      continue;
    }
    if (b.end - now > lead || b.end - b.start <= lead) continue;
    const key = `b:${instance}:${b.end}`;
    if (alerted.has(key)) continue;
    alerted.add(key);
    const o = mine.buffs[b.a];
    if (o?.sound) ding();
    if (o?.voice) speak(buffName(b.a));
  }
  if (alerted.size > 500) alerted.clear();
  checkAway();
  // Icons that just ran out go (or turn ready).
  if (any) changed();
}, 250);

// ---- The page ----------------------------------------------------------

const els = {
  show: $(".show"), lock: $(".lock"), autoAdd: $(".autoAdd"), ownBuffs: $(".ownBuffs"),
  layout: $(".layout"), size: $(".size"), direction: $(".direction"), perLine: $(".perLine"), opacity: $(".opacity"),
  numbers: $(".numbers"), readyGlow: $(".readyGlow"), sound: $(".sound"), voice: $(".voice"), lead: $(".lead"),
  combatOnly: $(".combatOnly"), combatAfter: $(".combatAfter"),
};
let tab = "skills";
let openRow = null;

function translate() {
  for (const el of document.querySelectorAll("[data-t]")) {
    const text = words[el.dataset.t];
    if (text) el.textContent = text;
  }
  for (const el of document.querySelectorAll("[data-tp]")) el.placeholder = words[el.dataset.tp] || el.placeholder;
  const names = SOUND_NAMES[lang] || SOUND_NAMES.en;
  els.sound.replaceChildren(
    ...[...SOUND_ORDER, "off"].map((v) => Object.assign(document.createElement("option"), { value: v, textContent: v === "off" ? words.none : names[v] })),
  );
  els.sound.value = prefs.sound;
}

const seconds = (ms) => {
  const s = ms / 1000;
  return s >= 100 ? `${Math.round(s)} s` : `${s.toFixed(1).replace(/\.0$/, "")} s`;
};

const img = (icon) => {
  const i = document.createElement("img");
  i.className = "ico";
  i.alt = "";
  // From icons.js: on Linux a file path set from a script shows nothing.
  const url = icon && window.COOLDOWN_ICONS?.[icon];
  if (url) i.src = url;
  return i;
};

// A check box with its words, for a row's options.
function check(text, on, change) {
  const label = document.createElement("label");
  label.className = "opt";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !!on;
  box.addEventListener("change", () => change(box.checked));
  label.append(box, " ", text);
  return label;
}

// One skill or buff: its icon, name and time, a show switch; a click opens its
// options under it.
function row({ id, icon, name, time, timeTitle, shown, onShow, options }) {
  const li = document.createElement("li");
  li.className = "item";
  if (openRow === id) li.classList.add("isOpen");
  const head = document.createElement("div");
  head.className = "head";
  const label = document.createElement("span");
  label.className = "name";
  label.textContent = name;
  label.title = name;
  const t = document.createElement("span");
  t.className = "time";
  t.textContent = time || "";
  if (timeTitle) t.title = timeTitle;
  const sw = document.createElement("input");
  sw.type = "checkbox";
  sw.className = "toggle";
  sw.checked = !!shown;
  sw.setAttribute("aria-label", words.optShow);
  sw.addEventListener("click", (e) => e.stopPropagation());
  sw.addEventListener("change", () => onShow(sw.checked));
  head.append(img(icon), label, t, sw);
  head.addEventListener("click", () => {
    openRow = openRow === id ? null : id;
    for (const other of document.querySelectorAll(".item.isOpen")) if (other !== li) other.classList.remove("isOpen");
    li.classList.toggle("isOpen", openRow === id);
  });
  const opts = document.createElement("div");
  opts.className = "opts";
  opts.append(...options);
  li.append(head, opts);
  return li;
}

function renderSkills() {
  const list = $(".skillList");
  const cls = mine.cls;
  $(".cls").textContent = cls ? words.classes[cls] || "" : words.noClass;
  const filter = $(".skillFilter").value.trim().toLowerCase();
  const skills = (LISTED[cls] || []).filter((s) => !filter || skillName(s.g).toLowerCase().includes(filter));
  list.replaceChildren(
    ...skills.map((s) => {
      const g = s.g;
      const o = mine.skills[g] || {};
      const learned = mine.learned[g];
      const set = (key, value) => {
        mine.skills[g] = { ...(mine.skills[g] || {}), [key]: value };
        saveMine();
        if (key === "show") placeWidgets();
        else changed();
      };
      return row({
        id: `s${g}`, icon: s.icon, name: skillName(g),
        time: `${learned ? "" : "≈ "}${seconds(cooldownOf(g))}`,
        timeTitle: learned ? words.learned : words.base,
        shown: o.show, onShow: (on) => set("show", on),
        options: [
          check(words.optAlways, o.always, (v) => set("always", v)),
          check(words.optSound, o.sound, (v) => set("sound", v)),
          check(words.optVoice, o.voice, (v) => set("voice", v)),
        ],
      });
    }),
  );
  $(".skillEmpty").hidden = !!skills.length || !!filter;
}

function renderBuffs() {
  const list = $(".buffList");
  const filter = $(".buffFilter").value.trim().toLowerCase();
  const ids = Object.keys(mine.buffs)
    .map(Number)
    .filter((a) => DATA.buffs?.[a])
    .filter((a) => !filter || buffName(a).toLowerCase().includes(filter))
    .sort((x, y) => (mine.buffs[y].seen || 0) - (mine.buffs[x].seen || 0));
  list.replaceChildren(
    ...ids.map((a) => {
      const o = mine.buffs[a];
      const set = (key, value) => {
        mine.buffs[a] = { ...mine.buffs[a], [key]: value };
        saveMine();
        if (key === "show") placeWidgets();
        else changed();
      };
      return row({
        id: `b${a}`, icon: buffIcon(a), name: buffName(a), time: o.skill ? skillName(o.skill) : "",
        shown: o.show, onShow: (on) => set("show", on),
        options: [
          check(words.optBuffSound, o.sound, (v) => set("sound", v)),
          check(words.optBuffVoice, o.voice, (v) => set("voice", v)),
        ],
      });
    }),
  );
  $(".buffEmpty").hidden = !!ids.length || !!filter;
}

const showCombatAfter = () => ($(".combatAfterRow").hidden = !prefs.combatOnly);
function renderAll() {
  translate();
  showCombatAfter();
  for (const [key, el] of Object.entries(els)) {
    if (key === "lock" || !(key in prefs)) continue;
    if (el.type === "checkbox") el.checked = !!prefs[key];
    else el.value = String(prefs[key]);
  }
  renderSkills();
  renderBuffs();
  placeWidgets();
}

for (const b of document.querySelectorAll(".tab")) {
  b.addEventListener("click", () => {
    tab = b.dataset.tab;
    for (const x of document.querySelectorAll(".tab")) x.classList.toggle("isActive", x === b);
    for (const p of document.querySelectorAll(".pane")) p.hidden = p.dataset.pane !== tab;
    if (tab === "buffs") renderBuffs();
  });
}
$(".skillFilter").addEventListener("input", renderSkills);
$(".buffFilter").addEventListener("input", renderBuffs);

for (const [key, el] of Object.entries(els)) {
  if (key === "lock") continue;
  el.addEventListener(el.type === "range" ? "input" : "change", () => {
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (key === "perLine") v = Math.max(1, Math.min(20, Math.round(Number(v)) || DEFAULTS.perLine));
    if (key === "lead") v = Math.max(1, Math.min(30, Math.round(Number(v)) || DEFAULTS.lead));
    if (key === "combatAfter") v = Math.max(3, Math.min(120, Math.round(Number(v)) || DEFAULTS.combatAfter));
    if (key === "opacity") v = Number(v);
    prefs[key] = v;
    if (el.type === "number") el.value = v;
    save();
    if (["show", "layout", "size", "direction", "perLine"].includes(key)) placeWidgets();
    else if (key === "ownBuffs" || key === "opacity" || key === "numbers" || key === "readyGlow") send();
    if (key === "combatOnly" || key === "combatAfter") {
      showCombatAfter();
      checkAway();
    }
  });
}
els.lock.addEventListener("change", () => a2.widgets.lock(els.lock.checked).catch(() => {}));
$(".test").addEventListener("click", (e) => {
  e.preventDefault();
  ding();
  const voiceWas = prefs.voice;
  prefs.voice = true;
  if (voiceWas) speak(words.skills);
  prefs.voice = voiceWas;
});

// ---- The meter -------------------------------------------------------------

const atOf = (meta) => (meta && typeof meta.at === "number" ? meta.at : Date.now());
a2.on("decoded:skill-used", (d, meta) => onSkill(d, atOf(meta)));
a2.on("decoded:cooldowns", (d, meta) => onCooldowns(d, atOf(meta)));
a2.on("decoded:buff-added", (d, meta) => onBuffAdded(d, atOf(meta)));
a2.on("decoded:buff-changed", (d, meta) => onBuffChanged(d, atOf(meta)));
a2.on("decoded:buff-removed", (d, meta) => onBuffRemoved(d, atOf(meta)));
a2.on("character", (c) => loadCharacter(c));
a2.on("game", (d) => {
  const open = !!(d && d.running);
  if (open === gameOpen) return;
  gameOpen = open;
  placeWidgets();
});
a2.on("language", (code) => {
  lang = UI[code] ? code : UI[String(code).split("-")[0]] ? String(code).split("-")[0] : "en";
  words = UI[lang];
  translate();
  renderSkills();
  renderBuffs();
});
a2.on("locked", (on) => {
  els.lock.checked = !!on;
});
a2.on("widget-message", ({ data }) => {
  if (data && data.open) a2.window?.show?.();
});

(async () => {
  const stored = await a2.storage.get("prefs").catch(() => null);
  if (stored && typeof stored === "object") prefs = { ...DEFAULTS, ...stored };
  const before = await a2.storage.get("char:?").catch(() => null);
  if (before && typeof before === "object") mine = { ...mine, ...before };
  els.lock.checked = await a2.widgets.locked().catch(() => false);
  renderAll();
  a2.ready();
})();
