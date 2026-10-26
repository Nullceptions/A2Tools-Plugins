// Enhanced Boss Telegraph: a boss's lines and mechanics spoken and shown in big text.
// The rules are in logic.js; this page holds the settings, the voice and the
// widget. Nothing leaves the computer: no network, only the meter's storage.
const $ = (s) => document.querySelector(s);
const DATA = window.BOSS_CALLOUTS || { langs: ["en"], texts: [], groups: {}, bosses: {}, calls: [] };

const DEFAULTS = {
  enabled: true, widget: true, style: "both",
  size: "60", fg: "#ffff00", safe: "#66ff66", bg: "#000000", bgOpacity: 85,
  volume: 100, voiceName: "", rate: "1",
  offBoss: {}, offCall: {}, waves: {},
};
let prefs = { ...DEFAULTS };
let lang = "en";
let words = UI.en;
let gameOpen = false;
let locked = false;

const T = (i) => {
  if (i == null) return "";
  const t = DATA.texts[i];
  return (t && (t[lang] || t.en)) || "";
};
const save = () => a2.storage.set("prefs", prefs).catch(() => {});

// ---- The voice ---------------------------------------------------------

// The computer's voices come a moment after the page opens (voiceschanged).
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
const volumeGain = (percent) => Math.pow(Math.max(0, Math.min(100, Number(percent) || 0)) / 100, 2);

// What is waiting to be said: two at most. A new mechanic ("high") cuts off
// a boss's line still being read ("low") or a backlog, so the call that
// matters now is heard now; a line that comes while two wait is dropped.
const saying = new Map(); // utterance -> { at, prio }
function say(text, prio = "high") {
  if (!synth || !text || prefs.volume <= 0) return;
  const now = Date.now();
  for (const [u, s] of saying) if (now - s.at > 15_000) saying.delete(u);
  const lowWaiting = [...saying.values()].some((s) => s.prio === "low");
  if (prio === "high" && (saying.size >= 2 || lowWaiting)) {
    synth.cancel();
    saying.clear();
  } else if (prio === "low" && saying.size >= 2) {
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang || lang;
  u.rate = Number(prefs.rate) || 1;
  u.pitch = 1;
  u.volume = volumeGain(prefs.volume);
  u.onend = u.onerror = () => saying.delete(u);
  saying.set(u, { at: now, prio });
  synth.speak(u);
}

// A wave's beep: short, high, at the volume.
let audio = null;
function beep() {
  if (prefs.volume <= 0) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = 1320;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25 * volumeGain(prefs.volume) + 0.0001, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch {
    /* no audio: the widget still shows */
  }
}

// ---- The widget --------------------------------------------------------

let shown = [];
const engine = BossLogic.create(DATA, {
  now: () => Date.now(),
  prefs: () => prefs,
  lang: () => lang,
  say,
  beep,
  show: (items) => {
    shown = items;
    send();
  },
});

let widgetOpen = false;
let lastSize = "";
const widgetSize = () => {
  const s = Number(prefs.size) || 60;
  return { width: Math.round(Math.min(1100, Math.max(520, s * 13))), height: Math.round(s * 3.4 + 48) };
};
async function placeWidget() {
  const want = prefs.enabled && prefs.widget && gameOpen;
  const size = JSON.stringify(widgetSize());
  if (!want) {
    if (widgetOpen) await a2.widgets.close("callout").catch(() => {});
    widgetOpen = false;
    lastSize = "";
    return;
  }
  if (!widgetOpen || size !== lastSize) {
    await a2.widgets.open("callout", widgetSize()).catch(() => {});
    widgetOpen = true;
    lastSize = size;
  }
  send();
}
function send() {
  if (!widgetOpen) return;
  const look = { size: Number(prefs.size) || 60, fg: prefs.fg, safe: prefs.safe, bg: prefs.bg, bgOpacity: prefs.bgOpacity / 100 };
  const items = shown.slice(0, 2).map(({ kind, text, sub, end, until }) => ({ kind, text, sub, end, until }));
  a2.widgets.send("callout", { look, items, preview: { text: words.preview, sub: words.previewSub } }).catch(() => {});
}

// ---- The page ----------------------------------------------------------

const els = {
  enabled: $(".enabled"), widget: $(".widget"), style: $(".style"),
  size: $(".size"), fg: $(".fg"), safe: $(".safe"), bg: $(".bg"), bgOpacity: $(".bgOpacity"),
  volume: $(".volume"), voiceName: $(".voiceName"), rate: $(".rate"),
};

function translate() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-t]")) {
    const text = words[el.dataset.t];
    if (text) el.textContent = text;
  }
  for (const el of document.querySelectorAll("[data-tp]")) el.placeholder = words[el.dataset.tp] || el.placeholder;
  fillVoices();
  $(".voiceNote").textContent = synth ? words.voiceNote : words.noVoices;
}

// The voices: the automatic one first, then the meter's language's, then the
// rest. A saved voice not listed (not loaded yet) keeps its place.
function fillVoices() {
  const el = els.voiceName;
  const opt = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
  const byName = (x, y) => x.name.localeCompare(y.name);
  const others = voices.filter((v) => !inLanguage(v)).sort((x, y) => (x.lang || "").localeCompare(y.lang || "") || byName(x, y));
  const options = [opt("", words.voiceDefault), ...[...voices.filter(inLanguage).sort(byName), ...others].map((v) => opt(v.voiceURI || v.name, `${v.name} (${v.lang})`))];
  if (prefs.voiceName && !options.some((o) => o.value === prefs.voiceName)) options.push(opt(prefs.voiceName, prefs.voiceName));
  el.replaceChildren(...options);
  el.value = prefs.voiceName;
}

function showPrefs() {
  for (const [key, el] of Object.entries(els)) {
    if (key === "voiceName") continue;
    if (el.type === "checkbox") el.checked = !!prefs[key];
    else el.value = String(prefs[key]);
  }
  els.voiceName.value = prefs.voiceName;
}

// What a call is, in the list: its short call (if curated), the boss's line,
// the buff's name, and what sets it off.
function callRow(c) {
  const li = document.createElement("li");
  const row = document.createElement("label");
  row.className = "call";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !prefs.offCall[c.k];
  box.addEventListener("change", () => {
    if (box.checked) delete prefs.offCall[c.k];
    else prefs.offCall[c.k] = true;
    row.classList.toggle("isOff", !box.checked);
    save();
  });
  const what = document.createElement("span");
  what.className = "what";
  if (c.act) {
    const a = document.createElement("span");
    a.className = "act";
    a.textContent = T(c.act);
    what.append(a, document.createTextNode(T(c.line) ? ` · ${T(c.line)}` : ""));
  } else {
    what.textContent = T(c.line) || T(c.n);
  }
  const kind = document.createElement("span");
  kind.className = "kind";
  const trig = c.t === "cast" ? words.trigCast : c.t === "use" ? words.trigUse : words.trigBuff;
  const extra = [c.t === "abnormal" && T(c.n), c.lead ? `${(c.lead / 1000).toFixed(1).replace(/\.0$/, "")} s` : "", c.act ? words.tagCall : ""].filter(Boolean);
  kind.textContent = [trig, ...extra].join(" · ");
  row.append(box, what, kind);
  row.classList.toggle("isOff", !box.checked);
  li.append(row);
  if (c.waves) {
    // Its waves' beep (03 38), on unless turned off.
    const w = document.createElement("label");
    w.className = "waves";
    const wb = document.createElement("input");
    wb.type = "checkbox";
    wb.checked = prefs.waves[c.k] !== false;
    wb.addEventListener("change", () => {
      prefs.waves[c.k] = wb.checked;
      save();
    });
    const t = document.createElement("span");
    t.textContent = words.beepWaves;
    w.append(wb, t);
    li.append(w);
  }
  return li;
}

// Dungeons (open while filtering), their bosses, each boss's calls. A
// mechanic with several ids (a skill's easy and normal copies) is one row.
const openGroups = new Set();
function renderBosses() {
  const q = $(".filter").value.trim().toLowerCase();
  const byBoss = new Map();
  for (const c of DATA.calls) {
    const list = byBoss.get(c.b) || [];
    if (!list.some((x) => x.k === c.k)) list.push(c);
    byBoss.set(c.b, list);
  }
  const groupName = (g) => T(DATA.groups[g]?.n) || (g === "c:Dungeon" ? words.groupDungeon : words.groupOther);
  const out = [];
  for (const g of Object.keys(DATA.groups)) {
    const bosses = Object.entries(DATA.bosses).filter(([, b]) => b.g === g).sort((x, y) => T(x[1].n).localeCompare(T(y[1].n)));
    const det = document.createElement("details");
    det.className = "group";
    const sum = document.createElement("summary");
    sum.textContent = groupName(g);
    det.append(sum);
    let any = false;
    for (const [key, b] of bosses) {
      const calls = byBoss.get(key) || [];
      const hit = !q || groupName(g).toLowerCase().includes(q) || T(b.n).toLowerCase().includes(q) ||
        calls.some((c) => [T(c.act), T(c.line), T(c.n)].some((s) => s.toLowerCase().includes(q)));
      if (!hit || !calls.length) continue;
      any = true;
      const div = document.createElement("div");
      div.className = "boss";
      const head = document.createElement("label");
      head.className = "bossHead";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !prefs.offBoss[key];
      box.addEventListener("change", () => {
        if (box.checked) delete prefs.offBoss[key];
        else prefs.offBoss[key] = true;
        div.classList.toggle("isOff", !box.checked);
        save();
      });
      head.append(box, document.createTextNode(T(b.n)));
      div.classList.toggle("isOff", !box.checked);
      const ul = document.createElement("ul");
      ul.className = "calls";
      // Curated mechanics first.
      for (const c of [...calls].sort((x, y) => !!y.act - !!x.act)) ul.append(callRow(c));
      div.append(head, ul);
      det.append(div);
    }
    if (!any) continue;
    det.open = !!q || openGroups.has(g);
    det.addEventListener("toggle", () => {
      if (q) return;
      if (det.open) openGroups.add(g);
      else openGroups.delete(g);
    });
    out.push(det);
  }
  $(".groups").replaceChildren(...out);
}

for (const b of document.querySelectorAll(".tab")) {
  b.addEventListener("click", () => {
    for (const x of document.querySelectorAll(".tab")) x.classList.toggle("isActive", x === b);
    for (const p of document.querySelectorAll(".pane")) p.hidden = p.dataset.pane !== b.dataset.tab;
  });
}
$(".filter").addEventListener("input", renderBosses);
$(".allOn").addEventListener("click", () => {
  prefs.offBoss = {};
  prefs.offCall = {};
  save();
  renderBosses();
});
$(".allOff").addEventListener("click", () => {
  for (const k of Object.keys(DATA.bosses)) prefs.offBoss[k] = true;
  save();
  renderBosses();
});
$(".contrast").addEventListener("click", () => {
  for (const k of ["fg", "safe", "bg", "bgOpacity"]) prefs[k] = DEFAULTS[k];
  showPrefs();
  save();
  send();
});
$(".test").addEventListener("click", () => engine.test());

for (const [key, el] of Object.entries(els)) {
  el.addEventListener(el.type === "range" || el.type === "color" ? "input" : "change", () => {
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (key === "volume" || key === "bgOpacity") v = Number(v);
    prefs[key] = v;
    save();
    if (key === "enabled" || key === "widget" || key === "size") placeWidget();
    else send();
    if (key === "enabled" && !v) engine.clear();
    if (key === "voiceName" || key === "rate") say(words.preview);
  });
}
// The volume, heard where the slider is let go.
els.volume.addEventListener("change", () => say(words.preview));
$(".lock").addEventListener("change", (e) => a2.widgets.lock(e.target.checked).catch(() => {}));
if (synth) {
  loadVoices();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", loadVoices);
  else synth.onvoiceschanged = loadVoices;
}
setInterval(() => engine.tick(), 100);

// ---- The meter ---------------------------------------------------------

const atOf = (meta) => (meta && typeof meta.at === "number" ? meta.at : Date.now());
a2.on("decoded:boss-cast", (d, meta) => engine.cast(d, atOf(meta)));
a2.on("decoded:boss-skill", (d, meta) => engine.use(d, atOf(meta)));
a2.on("decoded:boss-wave", (d, meta) => engine.wave(d, atOf(meta)));
a2.on("decoded:boss-buff-added", (d, meta) => engine.added(d, atOf(meta)));
a2.on("decoded:boss-buff-removed", (d, meta) => engine.removed(d, atOf(meta)));
a2.on("language", (code) => {
  lang = UI[code] ? code : UI[String(code).split("-")[0]] ? String(code).split("-")[0] : "en";
  words = UI[lang];
  translate();
  renderBosses();
  send();
});
a2.on("game", (d) => {
  const open = !!(d && d.running);
  if (open === gameOpen) return;
  gameOpen = open;
  if (!open) engine.clear();
  placeWidget();
});
a2.on("locked", (on) => {
  locked = !!on;
  $(".lock").checked = locked;
});
a2.on("widget-message", ({ data }) => {
  if (data && data.open) a2.window?.show?.();
});

(async () => {
  const stored = await a2.storage.get("prefs").catch(() => null);
  if (stored && typeof stored === "object") {
    prefs = { ...DEFAULTS, ...stored };
    for (const k of ["offBoss", "offCall", "waves"]) prefs[k] = { ...(stored[k] || {}) };
  }
  locked = await a2.widgets.locked().catch(() => false);
  $(".lock").checked = locked;
  showPrefs();
  translate();
  renderBosses();
  placeWidget();
  a2.ready();
})();
