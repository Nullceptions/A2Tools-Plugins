// Mantra Watch: your mantras on or off, how many party members each reaches,
// an alert the moment one drops in a fight, and each fight's uptime.
const { MANTRAS, tickOf, isFightHit, Fight, TICK_MS, DROP_MS, FIGHT_IDLE_MS, MIN_FIGHT_MS, LANDED_QUIET_MS, LOAD_QUIET_MS } = globalThis.MantraLogic;
const $ = (sel, root = document) => root.querySelector(sel);

// The mantras' names in the meter's languages, from its skill list.
const NAMES = {
  de: { 1816: "Invokation des Sprints", 1819: "Invokation der Unbesiegbarkeit" },
  en: { 1816: "Sprint Mantra", 1819: "Undefeated Mantra" },
  es: { 1816: "Proclama de esprint", 1819: "Proclama del invicto" },
  fr: { 1816: "Mantra de sprint", 1819: "Mantra d'invincibilité" },
  ja: { 1816: "疾走のマントラ", 1819: "不敗のマントラ" },
  ko: { 1816: "질주의 진언", 1819: "불패의 진언" },
  pt: { 1816: "Mantra da Disparada", 1819: "Mantra do Imbatível" },
  ru: { 1816: "Заклятие ускорения", 1819: "Песнь непобедимости" },
  "zh-Hans": { 1816: "疾走真言", 1819: "不败真言" },
  "zh-Hant": { 1816: "疾走真言", 1819: "不敗真言" },
};
let lang = "en";
const nameOf = (m) => (NAMES[lang] || NAMES.en)[m];

// ── State ──────────────────────────────────────────────────────────────────
// Events older than this are the meter's replay of what came before the
// window opened: no use for what is on now.
const STALE_MS = 5_000;
const lastTick = {}; // mantra -> when it last ticked on you
const reach = {}; // mantra -> Map(entity -> last tick on them)
let fight = null;
let lastHit = 0;
let quietUntil = 0; // no alert before this: a teleport is loading
const prefs = { alert: "fight", sound: "alarm" };
let fights = []; // the last fights: { at, length, uptime: { mantra: 0..1 } }

const isOn = (m, now) => now - (lastTick[m] || 0) < DROP_MS;
const inFight = (now) => fight && now - lastHit < FIGHT_IDLE_MS;

// ── Records ────────────────────────────────────────────────────────────────
a2.on("decoded:mantra-tick", (d, meta) => {
  const t = tickOf(d);
  const at = meta.at || Date.now();
  if (!t || Date.now() - at > STALE_MS) return;
  if (t.onMe) {
    lastTick[t.mantra] = at;
    fight?.tick(t.mantra, at);
  } else {
    (reach[t.mantra] ||= new Map()).set(t.on, at);
  }
  update();
});
a2.on("decoded:my-hit", (d, meta) => {
  const at = meta.at || Date.now();
  if (!isFightHit(d) || Date.now() - at > STALE_MS) return;
  if (!inFight(at)) {
    endFight();
    fight = new Fight(at);
    // A tick just before the first hit still covers its start.
    for (const m of MANTRAS) if (at - (lastTick[m] || 0) < TICK_MS) fight.tick(m, lastTick[m]);
  }
  fight.hit(at);
  lastHit = at;
  update();
});

// A teleport ends the fight, and the ticks it pauses are no drop.
a2.on("decoded:map-load", (_d, meta) => {
  const at = meta.at || Date.now();
  if (Date.now() - at > STALE_MS) return;
  endFight();
  for (const m of MANTRAS) reach[m]?.clear();
  quietUntil = at + LOAD_QUIET_MS;
  update();
});
a2.on("decoded:landed", (_d, meta) => {
  const at = meta.at || Date.now();
  if (Date.now() - at > STALE_MS) return;
  quietUntil = at + LANDED_QUIET_MS;
  update();
});

function endFight() {
  if (!fight) return;
  const f = fight;
  fight = null;
  const length = f.last - f.start;
  if (length < MIN_FIGHT_MS) return;
  const uptime = Object.fromEntries(MANTRAS.map((m) => [m, f.uptime(m)]));
  // A fight with no mantra at all is likely not a Chanter's: not kept.
  if (!MANTRAS.some((m) => uptime[m] > 0)) return;
  fights = [{ at: f.start, length, uptime }, ...fights].slice(0, 20);
  a2.storage.set("fights", fights).catch(() => {});
}

// ── Drawing and alerts ─────────────────────────────────────────────────────
const rows = {};
for (const m of MANTRAS) {
  const li = document.createElement("li");
  li.innerHTML = '<span class="dot"></span><span class="name"></span><span class="reach"></span>';
  $(".mantras").append(li);
  rows[m] = li;
}
const pct = (x) => `${Math.round(x * 100)}%`;
const mmss = (ms) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;

let dropped = new Set(); // mantras the alert is up for
let hideAfterAlert = false;
let lastUse = 0;
for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, () => (lastUse = Date.now()), true);

function update() {
  const now = Date.now();
  if (fight && !inFight(now)) endFight();
  for (const m of MANTRAS) {
    const li = rows[m];
    const on = isOn(m, now);
    li.classList.toggle("on", on);
    li.classList.toggle("seen", !!lastTick[m]);
    $(".name", li).textContent = nameOf(m);
    const n = [...(reach[m] || new Map()).values()].filter((at) => now - at < DROP_MS).length;
    $(".reach", li).textContent = on && n ? `+${n}` : "";
    $(".reach", li).title = "Party members it reaches";
  }
  $(".fight").textContent = fight ? `Fighting ${mmss(fight.last - fight.start)} · ${MANTRAS.map((m) => pct(fight.uptime(m))).join(" · ")}` : lastFightText();
  checkDrops(now);
}

function lastFightText() {
  if (!fights.length) return "No fight yet";
  const f = fights[0];
  const recent = fights.slice(0, 10);
  const avg = MANTRAS.map((m) => pct(recent.reduce((s, x) => s + (x.uptime[m] || 0), 0) / recent.length));
  return `Last fight ${mmss(f.length)} · ${MANTRAS.map((m) => pct(f.uptime[m] || 0)).join(" · ")}` + (recent.length > 1 ? ` (last ${recent.length}: ${avg.join(" · ")})` : "");
}

// A mantra that was up and stopped ticking: in a fight (or always, or never,
// as chosen). The alert goes when it is back, or the fight is over.
function checkDrops(now) {
  const watching = now >= quietUntil && (prefs.alert === "always" || (prefs.alert === "fight" && inFight(now)));
  const nowDropped = new Set(
    watching ? MANTRAS.filter((m) => lastTick[m] && !isOn(m, now) && now - lastTick[m] < 60_000 * 10) : [],
  );
  const fresh = [...nowDropped].filter((m) => !dropped.has(m));
  if (fresh.length) {
    if (!dropped.size) hideAfterAlert = Date.now() - lastUse > 60_000;
    playSound(prefs.sound);
    a2.window?.show().catch(() => {});
  }
  dropped = nowDropped;
  $(".banner").hidden = !dropped.size;
  $(".banner").textContent = [...dropped].map((m) => `${nameOf(m)} is off!`).join(" ");
  for (const m of MANTRAS) rows[m].classList.toggle("dropped", dropped.has(m));
  if (!dropped.size && hideAfterAlert && !fresh.length) {
    hideAfterAlert = false;
    a2.window?.hide().catch(() => {});
  }
}

// ── Sounds (no files: notes made with Web Audio) ───────────────────────────
const SOUNDS = {
  alarm: [
    [988, 0, 0.14, "square", 0.07], [784, 0.16, 0.14, "square", 0.07],
    [988, 0.32, 0.14, "square", 0.07], [784, 0.48, 0.14, "square", 0.07],
  ],
  chime: [[880, 0, 0.45, "sine", 0.25], [1320, 0.16, 0.5, "sine", 0.25]],
  ping: [[1760, 0, 0.3, "sine", 0.22], [1760, 0.35, 0.3, "sine", 0.14]],
};
let audio = null;
function playSound(name) {
  const notes = SOUNDS[name];
  if (!notes) return;
  try {
    audio ||= new AudioContext();
    // Not awaited: in a hidden window WebKitGTK's resume() waits for the page
    // to be used, and a sound that waited for it stayed silent.
    if (audio.state !== "running") audio.resume().catch(() => {});
    for (const [freq, start, length, wave, volume] of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const t = audio.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  } catch (e) {
    console.warn(e);
  }
}

// ── Settings ───────────────────────────────────────────────────────────────
$(".gear").addEventListener("click", () => {
  $(".settings").hidden = !$(".settings").hidden;
});
for (const key of ["alert", "sound"]) {
  $(`.${key}`).addEventListener("change", (e) => {
    prefs[key] = e.target.value;
    a2.storage.set("prefs", prefs).catch(() => {});
    update();
  });
}
$(".test").addEventListener("click", () => playSound(prefs.sound));
a2.on("language", (code) => {
  lang = code in NAMES ? code : "en";
  update();
});
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

(async () => {
  const [savedPrefs, savedFights] = await Promise.all([a2.storage.get("prefs").catch(() => null), a2.storage.get("fights").catch(() => null)]);
  Object.assign(prefs, savedPrefs || {});
  if (Array.isArray(savedFights)) fights = savedFights;
  $(".alert").value = prefs.alert;
  $(".sound").value = prefs.sound;
  update();
  a2.ready();
  setInterval(update, 250);
})();
