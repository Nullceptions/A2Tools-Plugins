// Cooldowns: your skill cooldowns and buffs as icons over the game.
//
// What the game says (decoders in manifest.json; worked out from captures,
// 2026-10-20):
//   01 38  you used a skill: its id (a variant of the skill, e.g. 14060010 for
//          base 14060000; the base is the cooldown's group).
//   47 38  cooldowns: a list of (group, ms left). One entry when something
//          changed a cooldown (a reset reads 0), the first of them after a
//          use giving the whole cooldown; for some classes every group at
//          once now and then. The game works the cooldown out itself, with
//          your cooldown reduction, so nothing says it when a skill is used.
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

// The buffs your class's skills put on you (selfbuffs.js), listed on the
// Buffs tab before they have ever been on you. A buff comes in many ids (one
// per skill level or variant, one name and icon): it is kept, shown and
// alerted under the first, so ticking it once covers every rank.
const SELF = window.COOLDOWN_SELF_BUFFS || {};
const FAMILY = new Map(); // abnormal id -> the id its buff goes by
const SELF_SKILL = new Map(); // that id -> the skill (group) giving it
for (const list of Object.values(SELF)) {
  for (const [g, ids] of list) {
    const key = FAMILY.get(ids[0]) ?? ids[0];
    for (const a of ids) if (!FAMILY.has(a)) FAMILY.set(a, key);
    if (g && !SELF_SKILL.has(key)) SELF_SKILL.set(key, g);
  }
}
const buffKey = (a) => FAMILY.get(a) ?? a;
const classBuffs = (cls) => [...new Set((SELF[cls] || []).map(([, ids]) => buffKey(ids[0])))];
// A setup's buffs under the ids they go by: before 0.2.0 each rank of a buff
// was a row of its own. The row under the id itself wins, then a shown one.
function byFamily(buffs) {
  const out = {};
  const own = new Set();
  for (const [id, o] of Object.entries(buffs || {})) {
    const a = Number(id);
    const key = buffKey(a);
    const had = out[key];
    if (!had || a === key || (o.show && !had.show && !own.has(key))) {
      out[key] = { ...o, seen: Math.max(o.seen || 0, had?.seen || 0) || undefined };
      if (a === key) own.add(key);
    }
  }
  return out;
}

// ---- Settings ----------------------------------------------------------

// The look and the alerts, for every character.
const DEFAULTS = {
  show: true, autoAdd: true, ownBuffs: true,
  layout: "combined", size: "42", direction: "right", perLine: 10, opacity: 100,
  numbers: true, readyGlow: true, sound: "chime", voice: false, lead: 3,
  combatOnly: false, combatAfter: 10,
  // 0.2.0: how a buff's time left shows ("bar": the green bar and border;
  // "ring": the border drains as a ring, the icon dims as it runs out), the
  // alerts' volume (%) and the voice ("": the first in the meter's language).
  buffStyle: "bar", volume: 100, voiceName: "",
};
let prefs = { ...DEFAULTS };
// What each character shows: { cls, skills: { g: opts }, buffs: { a: opts },
// learned: { g: ms } }, by "name@server".
let charKey = "?";
let mine = { cls: null, skills: {}, buffs: {}, learned: {}, learnedV: 2 };
// Times learnt before 0.1.6 are dropped once: one early use could set a
// time far too short, and an early use only ever lowers it again.
const LEARNED_V = 2;
const fresh = (m) => ({ ...(m.learnedV === LEARNED_V ? m : { ...m, learned: {}, learnedV: LEARNED_V }), buffs: byFamily(m.buffs) });

const save = () => a2.storage.set("prefs", prefs).catch(() => {});
// The storage key of a character's setup. The meter takes only letters,
// digits, "-" and "_" (up to 64): "char:name@server" was refused, and every
// character's ticked skills were lost with each restart. The name goes as
// its UTF-8 in hex (any script), a long one as a hash of it.
function charStoreKey(key) {
  if (key === "?") return "char_none";
  const at = key.lastIndexOf("@");
  const name = key.slice(0, at < 0 ? key.length : at);
  const server = (at < 0 ? "" : key.slice(at + 1)).replace(/[^0-9]/g, "");
  const hex = [...new TextEncoder().encode(name)].map((b) => b.toString(16).padStart(2, "0")).join("");
  let id = hex;
  if (`char_${hex}_${server}`.length > 64) {
    // FNV-1a, 32 bits, twice (two seeds): a name over ~27 bytes.
    const fnv = (seed) => {
      let h = seed >>> 0;
      for (const b of new TextEncoder().encode(name)) h = Math.imul(h ^ b, 16777619) >>> 0;
      return h.toString(16).padStart(8, "0");
    };
    id = `h${fnv(2166136261)}${fnv(84696351)}`;
  }
  return `char_${id}_${server}`;
}
const storeMine = (key, value) => a2.storage.set(charStoreKey(key), value).catch(() => {});
let saving = null;
// Per character, a moment after the last change (casts change it often).
const saveMine = () => {
  clearTimeout(saving);
  saving = setTimeout(() => storeMine(charKey, mine), 1500);
};

// The meter names classes in Korean; the skill data keys them by the skills'
// first two digits (entity/job_class.rs from_prefix).
const CLASS_IDS = { "검성": "11", "수호성": "12", "살성": "13", "궁성": "14", "마도성": "15", "정령성": "16", "치유성": "17", "호법성": "18", "권성": "19" };
let charName = null;

// The class the meter knows, over the one learnt from the last skill cast:
// so the right skills show from login, before anything is cast (Hirai).
function takeClass(c) {
  const cls = CLASS_IDS[c?.class];
  if (!cls || mine.cls === cls) return;
  mine.cls = cls;
  saveMine();
  renderSkills();
}

async function loadCharacter(c) {
  // No name: the meter is between zones, learning again who is playing.
  // That is no other character: what is shown stays. Taking it as one lost
  // the class and the ticked skills on entering a dungeon or the Shugo
  // Festival (Plexas, Hirai, 2026-10-22).
  if (!c || !c.name) return;
  const server = Number(c.serverId) || 0;
  const key = `${c.name}@${server || ""}`;
  // The same name with another server is the same character, its server
  // reported again as the meter relearns it; it moves only from a server
  // not known yet (0) to the real one, whose setup is the one saved.
  const knownServer = Number(charKey.split("@")[1]) || 0;
  if (c.name === charName && (key === charKey || knownServer || !server)) {
    takeClass(c);
    return;
  }
  const sameCharacter = c.name === charName;
  charName = c.name;
  clearTimeout(saving);
  if (charKey !== "?" && !sameCharacter) await storeMine(charKey, mine);
  const stored = await a2.storage.get(charStoreKey(key)).catch(() => null);
  // A first character takes what was set up before its name came, and one
  // whose server just became known what was set up meanwhile.
  const carried = (charKey === "?" || sameCharacter) && !stored ? mine : null;
  charKey = key;
  mine = fresh({ cls: null, skills: {}, buffs: {}, learned: {}, ...(stored || carried || {}) });
  takeClass(c);
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
  early: new Map(), // group -> the last early use's gap, not yet seen twice
  buffs: new Map(), // instance -> { a, skill, start, end }
  clock: null, // the server's clock minus ours (buff ends are in its time)
};

// How far measured cooldowns are below base: the median ratio, one per base
// time (the least reduced of those). An Elementalist's four 15 s summons run
// 12.9 s, more reduced than the rest (Curse 9.3 of 10, Corrode 41.85 of 45):
// counted four times they set every other skill's time 7% too short.
function reduction() {
  const byBase = new Map();
  for (const [g, ms] of Object.entries(mine.learned)) {
    const base = SKILLS.get(Number(g))?.cd || 0;
    const x = ms / base;
    if (!Number.isFinite(x) || x <= 0 || x > 1.2) continue;
    byBase.set(base, Math.max(byBase.get(base) || 0, x));
  }
  const r = [...byBase.values()].sort((a, b) => a - b);
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
  // Used again before its cooldown was due: the game let it, so its real
  // cooldown is at most the time since the last use (a Chanter's Power of
  // the Storm with its -30 s, 90 s, showed the base 120 s: long cooldowns are
  // rarely measured from a full list). Not when something changed or reset
  // it meanwhile, and only from half the base up: a skill with charges is
  // used again at once.
  // Twice alike, though: once is no cooldown (an Elementalist's Curse, 9.3 s,
  // came again after 7.1 s once in 33 minutes, and showed 7.1 s from then on).
  const before = live.used.get(g);
  const due = live.cd.get(g)?.end;
  if (before && due && at < due - 1000 && !live.changed.has(g) && !live.unsure.has(g)) {
    const gap = Math.round((at - before) / 50) * 50;
    if (gap >= s.cd * 0.5 && gap < cooldownOf(g)) {
      const was = live.early.get(g);
      live.early.set(g, gap);
      if (was && Math.abs(gap - was) <= Math.max(300, gap * 0.05)) {
        mine.learned[g] = Math.max(gap, was);
        renderSkills();
      }
    }
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
    const first = !live.changed.has(g);
    if (!ms) {
      if (was && was.end > at) live.cd.set(g, { ...was, end: at });
      if (used) live.unsure.add(g);
    } else {
      // More left than it had: used again without a word. Not the first
      // entry since a use, within the base time of it: what it had was
      // only the estimate (an Ancient Spirit's 82.5 s against 77.4 s).
      const fits = first && used && at + ms <= used + SKILLS.get(g).cd * 1.2;
      if (was && at + ms > was.end + 1000 && !fits) live.unsure.add(g);
      const start = was && was.end > at && !live.unsure.has(g) ? was.start : at + ms - Math.max(ms, cooldownOf(g));
      live.cd.set(g, { start, end: at + ms });
    }
    // A full list, or a group's first entry since its use: what is left,
    // plus the time since it was used, is its cooldown, when nothing changed
    // it and it wasn't used again unseen. An Elementalist's lists come one
    // group to a frame (its five summons, each proc that takes 1 s off
    // them), and the first after a cast always read the whole cooldown
    // (12.9 s of 15, 82.5 s of 90: 678 of 678 in a 50-minute capture).
    if (!all) live.changed.add(g);
    if (!first || !ms || !used || live.unsure.has(g) || at - used > 10 * 60_000) continue;
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
  const a = buffKey(Number(d.abnormal));
  const skill = d.flags & 2 ? groupOf(Number(d.skill)) : null;
  live.buffs.set(d.instance, { a, skill, start: at, end: end - live.clock });
  // Only the buffs the game shows (skills.js has those): the rest are its
  // own markers, with no name or icon.
  if (!mine.buffs[a] && DATA.buffs?.[a]) {
    mine.buffs[a] = { show: false, seen: Date.now() };
    if (skill) mine.buffs[a].skill = skill;
    saveMine();
    if (tab === "buffs") renderBuffs();
  } else if (mine.buffs[a] && !mine.buffs[a].seen) {
    // A class buff ticked before it came: had now.
    mine.buffs[a].seen = Date.now();
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
  else live.buffs.set(d.instance, { a: buffKey(Number(d.abnormal)), skill: null, start: at, end });
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
// buffs by when they were first seen (or ticked). A buff set to keep showing
// stays, greyed, while it isn't on you.
const buffOrder = (a) => mine.buffs[a].seen || mine.buffs[a].added || 0;
function slots() {
  const now = Date.now();
  const skills = [];
  const buffs = [];
  const onSkill = new Map(); // group -> its buff, for "both"
  const onBuff = new Map(); // a shown buff -> the one of it lasting longest
  for (const b of live.buffs.values()) {
    if (b.end <= now) continue;
    const o = mine.buffs[b.a];
    if (o?.show) {
      const cur = onBuff.get(b.a);
      if (!cur || cur.end < b.end) onBuff.set(b.a, b);
    } else if (prefs.ownBuffs && b.skill && (!o || o.show !== false || o.skill)) {
      const cur = onSkill.get(b.skill);
      if (!cur || cur.end < b.end) onSkill.set(b.skill, b);
    }
  }
  const shown = Object.keys(mine.buffs).map(Number).filter((a) => mine.buffs[a].show && DATA.buffs?.[a]);
  for (const a of shown.sort((x, y) => buffOrder(x) - buffOrder(y) || x - y)) {
    const b = onBuff.get(a);
    if (!b && !mine.buffs[a].always) continue;
    buffs.push({ key: `b${a}`, icon: buffIcon(a), buff: true, always: !!mine.buffs[a].always, buffStart: b?.start || 0, buffEnd: b?.end || 0 });
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
  const look = { size: Number(prefs.size), direction: prefs.direction, perLine: prefs.perLine, opacity: prefs.opacity / 100, numbers: prefs.numbers, readyGlow: prefs.readyGlow, ring: prefs.buffStyle === "ring", away };
  if (openNow.has("bar")) a2.widgets.send("bar", { look, slots: [...skills, ...buffs] }).catch(() => {});
  if (openNow.has("skills")) a2.widgets.send("skills", { look, slots: skills }).catch(() => {});
  if (openNow.has("buffs")) a2.widgets.send("buffs", { look, slots: buffs }).catch(() => {});
}

// A change: the icons now, and soon again (several records come together).
// The windows are sized again too: at start the class and its skills come
// after the bar opens, and a bar sized for its first 2 or 3 icons wrapped
// the rest until a setting changed (placeWidgets resizes only on a change).
let sendSoon = null;
function changed() {
  if (sendSoon) return;
  sendSoon = setTimeout(() => {
    sendSoon = null;
    placeWidgets();
  }, 60);
}

// ---- Alerts ------------------------------------------------------------

// The computer's voices come a moment after the page opens (voiceschanged):
// read before then, the list was empty and the first names were spoken by
// the system's default voice, whatever its language.
const synth = window.speechSynthesis || null;
let voices = [];
function loadVoices() {
  voices = synth?.getVoices?.() || [];
  fillVoices();
}
// A voice in the meter's language: for Traditional Chinese the Taiwan and
// Hong Kong voices, for Simplified the others.
const TRAD = /^zh[-_](tw|hk|mo|hant)/i;
function inLanguage(v) {
  const base = lang.split("-")[0].toLowerCase();
  const vl = (v.lang || "").toLowerCase();
  if (!vl.startsWith(base)) return false;
  if (base !== "zh") return true;
  return lang === "zh-Hant" ? TRAD.test(vl) : !TRAD.test(vl);
}
const sameBase = (v) => (v.lang || "").toLowerCase().startsWith(lang.split("-")[0].toLowerCase());
function pickVoice() {
  if (prefs.voiceName) {
    const v = voices.find((x) => x.voiceURI === prefs.voiceName || x.name === prefs.voiceName);
    if (v) return v;
  }
  return voices.find(inLanguage) || voices.find(sameBase) || null;
}
// What is waiting to be said: at most two, so names that come together are
// all heard but a burst of them never runs on long after (an entry whose end
// never came goes after 10 s).
const saying = new Map(); // utterance -> when queued
function say(text) {
  if (!synth || !text || prefs.volume <= 0) return;
  const now = Date.now();
  for (const [u, at] of saying) if (now - at > 10_000) saying.delete(u);
  if (saying.size >= 2) {
    synth.cancel();
    saying.clear();
  }
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang || lang;
  u.rate = 1;
  u.pitch = 1;
  u.volume = volumeGain(prefs.volume);
  u.onend = u.onerror = () => saying.delete(u);
  saying.set(u, now);
  synth.speak(u);
}
const speak = (text) => prefs.voice && say(text);
const ding = () => prefs.sound !== "off" && prefs.volume > 0 && typeof playSound === "function" && playSound(prefs.sound);
// A name to try a voice on: the first skill shown, or the word "Skills".
const sample = () => {
  const g = (LISTED[mine.cls] || []).find((s) => mine.skills[s.g]?.show)?.g;
  return g ? skillName(g) : words.skills;
};

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
  buffStyle: $(".buffStyle"), volume: $(".volume"), voiceName: $(".voiceName"),
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
  fillVoices();
}

// The voices: the automatic one first, then the meter's language's, then
// the rest, each by name. A saved voice not listed (uninstalled, or not
// loaded yet) keeps its place, so the choice isn't lost.
function fillVoices() {
  const el = els.voiceName;
  if (!el) return;
  const opt = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
  const byName = (x, y) => x.name.localeCompare(y.name);
  const others = voices.filter((v) => !inLanguage(v)).sort((x, y) => (x.lang || "").localeCompare(y.lang || "") || byName(x, y));
  const options = [opt("", words.voiceDefault), ...[...voices.filter(inLanguage).sort(byName), ...others].map((v) => opt(v.voiceURI || v.name, `${v.name} (${v.lang})`))];
  if (prefs.voiceName && !options.some((o) => o.value === prefs.voiceName)) options.push(opt(prefs.voiceName, prefs.voiceName));
  el.replaceChildren(...options);
  el.value = prefs.voiceName;
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
  // The buffs you've had, latest first, then your class's own not had yet
  // (and any ticked before they came), by name.
  const had = Object.keys(mine.buffs).map(Number).filter((a) => mine.buffs[a].seen);
  const rest = [...new Set([...Object.keys(mine.buffs).map(Number), ...classBuffs(mine.cls)])].filter((a) => !mine.buffs[a]?.seen);
  const ids = [
    ...had.sort((x, y) => mine.buffs[y].seen - mine.buffs[x].seen),
    ...rest.sort((x, y) => buffName(x).localeCompare(buffName(y))),
  ]
    .filter((a) => DATA.buffs?.[a])
    .filter((a) => !filter || buffName(a).toLowerCase().includes(filter));
  list.replaceChildren(
    ...ids.map((a) => {
      const o = mine.buffs[a] || {};
      const skill = o.skill || SELF_SKILL.get(a);
      const set = (key, value) => {
        // A class buff not had yet gets its row on its first change.
        const was = mine.buffs[a] || { show: false, added: Date.now(), ...(SELF_SKILL.has(a) ? { skill: SELF_SKILL.get(a) } : {}) };
        mine.buffs[a] = { ...was, [key]: value };
        saveMine();
        if (key === "show") placeWidgets();
        else changed();
      };
      return row({
        id: `b${a}`, icon: buffIcon(a), name: buffName(a), time: skill ? skillName(skill) : "",
        shown: o.show, onShow: (on) => set("show", on),
        options: [
          check(words.optBuffAlways, o.always, (v) => set("always", v)),
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
    if (key === "opacity" || key === "volume") v = Number(v);
    prefs[key] = v;
    if (el.type === "number") el.value = v;
    save();
    if (["show", "layout", "size", "direction", "perLine"].includes(key)) placeWidgets();
    else if (["ownBuffs", "opacity", "numbers", "readyGlow", "buffStyle"].includes(key)) send();
    if (key === "volume") setSoundVolume(v);
    // A voice picked is heard at once.
    if (key === "voiceName") say(sample());
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
  speak(sample());
});
// The volume, heard where the slider is let go.
els.volume.addEventListener("change", () => {
  ding();
  speak(sample());
});
if (synth) {
  loadVoices();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", loadVoices);
  else synth.onvoiceschanged = loadVoices;
}

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
  setSoundVolume(prefs.volume);
  const before = await a2.storage.get(charStoreKey("?")).catch(() => null);
  // Only while no character has come yet: the meter can name one before this
  // read returns, and its own setup stands then.
  if (before && typeof before === "object" && charKey === "?") mine = fresh({ ...mine, ...before });
  els.lock.checked = await a2.widgets.locked().catch(() => false);
  renderAll();
  a2.ready();
})();
