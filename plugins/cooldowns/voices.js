// The computer's voices, for spoken alerts. The same file is in Event Timers
// and Cooldowns (a plugin can't load another's files): change both.
//
// speechSynthesis gives each voice a name and a language, never whether it
// sounds female or male. That is guessed from the name: the words "Female" /
// "Male" in it (Google's voices, speech-dispatcher's "female1"), espeak's
// variants ("+f1".."+f5" female, "+m1".."+m7" male), else the first word
// of it found in VOICE_NAMES (Windows', Edge's online, macOS' and espeak's
// named voices). A voice none of these name stays unknown: it shows under
// "Any" only.

const VOICE_NAMES = (() => {
  const female = [
    // Windows (desktop and OneCore)
    "zira", "hazel", "susan", "catherine", "linda", "heera", "kalpana", "heami", "haruka", "ayumi", "sayaka",
    "hedda", "katja", "hortense", "julie", "caroline", "helena", "laura", "sabina", "maria", "francisca",
    "irina", "ekaterina", "huihui", "yaoyao", "hanhan", "yating", "tracy", "zuzana", "paulina", "elsa",
    // Edge / Azure online voices
    "aria", "jenny", "sonia", "libby", "michelle", "ana", "emma", "natasha", "clara", "sunhi", "jimin", "seohyun",
    "yujin", "nanami", "aoi", "mayu", "shiori", "xiaoxiao", "xiaoyi", "xiaohan", "xiaomo", "xiaoxuan", "xiaochen",
    "hsiaochen", "hsiaoyu", "hiumaan", "hiugaai", "amala", "elke", "louisa", "denise", "eloise", "vivienne",
    "brigitte", "elvira", "dalia", "thalita", "svetlana", "dariya", "neerja", "swara", "molly", "ava", "nancy", "jane",
    "sara", "amber", "ashley", "cora", "elizabeth", "maisie", "hollie", "abbi", "bella", "isabella", "seraphina",
    // macOS / iOS
    "samantha", "karen", "moira", "tessa", "kyoko", "yuna", "milena", "anna", "amelie", "monica", "luciana", "joana",
    "fiona", "victoria", "allison", "veena", "alice", "ioana", "sinji", "meijia", "tingting", "kathy", "princess",
    // espeak-ng variants
    "annie", "anika", "andrea", "belinda", "grandma", "alicia", "aunty", "steph", "zoe", "olga",
  ];
  const male = [
    "david", "mark", "george", "james", "richard", "ravi", "hemant", "ichiro", "stefan", "paul", "claude", "pablo",
    "raul", "daniel", "pavel", "kangkang", "zhiwei", "danny", "sean", "filip", "jakub",
    "guy", "ryan", "christopher", "eric", "roger", "steffan", "andrew", "brian", "thomas", "liam", "william", "davis",
    "tony", "jason", "brandon", "injoon", "bongjin", "gookmin", "hyunsu", "keita", "daichi", "naoki", "yunxi",
    "yunjian", "yunyang", "yunze", "yunfeng", "yunhao", "yunjhe", "wanlung", "conrad", "killian", "kasper", "henri",
    "remy", "alvaro", "jorge", "antonio", "dmitry", "prabhat", "madhur", "alfie", "elliot", "ethan", "noah", "oliver",
    "alex", "fred", "markus", "yuri", "juan", "otoya", "diego", "felipe", "aaron", "arthur", "gordon", "rishi",
    "grandpa", "edward", "max", "klaus", "karsten", "cosimo",
  ];
  const map = new Map();
  for (const n of female) map.set(n, "female");
  for (const n of male) map.set(n, "male");
  return map;
})();

// "female", "male", or "" when the name doesn't tell.
function voiceGender(v) {
  const name = String(v?.name ?? v ?? "");
  if (/female/i.test(name)) return "female";
  if (/\bmale/i.test(name)) return "male";
  const variant = /\+([fm])\d+\b/i.exec(name);
  if (variant) return variant[1].toLowerCase() === "f" ? "female" : "male";
  for (const word of name.toLowerCase().split(/[^\p{L}]+/u)) {
    const g = VOICE_NAMES.get(word);
    if (g) return g;
  }
  return "";
}

// A voice in the meter's language: for Traditional Chinese the Taiwan and
// Hong Kong voices, for Simplified the others.
const VOICE_TRAD = /^zh[-_](tw|hk|mo|hant)/i;
function voiceInLanguage(v, lang) {
  const base = String(lang).split("-")[0].toLowerCase();
  const vl = (v.lang || "").toLowerCase();
  if (!vl.startsWith(base)) return false;
  if (base !== "zh") return true;
  return lang === "zh-Hant" ? VOICE_TRAD.test(vl) : !VOICE_TRAD.test(vl);
}
const voiceSameBase = (v, lang) => (v.lang || "").toLowerCase().startsWith(String(lang).split("-")[0].toLowerCase());

// A voice's language in the meter's ("English (United States)"), or its code.
function voiceLanguage(code, uiLang) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([uiLang, "en"], { type: "language" }).of(String(code).replace("_", "-")) || code;
  } catch {
    return code;
  }
}

// In the list: its name without the language Windows adds (shown after, in
// the meter's language), ♀ or ♂ when known.
function voiceLabel(v, uiLang) {
  const g = voiceGender(v);
  const mark = g === "female" ? " ♀" : g === "male" ? " ♂" : "";
  const name = v.lang ? v.name.replace(/\s+-\s+[^-]+$/, "") : v.name;
  const language = voiceLanguage(v.lang, uiLang);
  return language ? `${name}${mark} · ${language}` : `${name}${mark}`;
}

// The speeds offered (1 = the voice's own).
const VOICE_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const VOICE_TYPES = ["any", "female", "male"];

// The voices for a plugin. `lang()` is the meter's language; `prefs()` gives
// { voiceName, voiceType, voiceRate, volume }; `onChange()` runs when the
// computer's voices arrive (a moment after the page opens: read before then
// the list is empty, and the first words came in the system's default voice,
// whatever its language).
function makeVoices({ lang, prefs, onChange }) {
  const synth = window.speechSynthesis || null;
  let all = [];
  const typeOf = () => (VOICE_TYPES.includes(prefs().voiceType) ? prefs().voiceType : "any");
  const fits = (v) => typeOf() === "any" || voiceGender(v) === typeOf();
  const byName = (x, y) => x.name.localeCompare(y.name);
  // The meter's language's voices first, then the rest by language, each by
  // name; only those of the type picked.
  const list = () => {
    const l = lang();
    const mine = all.filter((v) => voiceInLanguage(v, l)).sort(byName);
    const others = all.filter((v) => !voiceInLanguage(v, l)).sort((x, y) => (x.lang || "").localeCompare(y.lang || "") || byName(x, y));
    return [...mine, ...others].filter(fits);
  };
  const saved = () => {
    const name = prefs().voiceName;
    return name ? all.find((x) => x.voiceURI === name || x.name === name) || null : null;
  };
  // The voice chosen; with "Default", the first of the type picked in the
  // meter's language, else any in it.
  const pick = () => {
    const v = saved();
    if (v) return v;
    const l = lang();
    const typed = all.filter(fits);
    return typed.find((x) => voiceInLanguage(x, l)) || typed.find((x) => voiceSameBase(x, l))
      || all.find((x) => voiceInLanguage(x, l)) || all.find((x) => voiceSameBase(x, l)) || null;
  };
  // The Voice list: Default first. A saved voice not listed (uninstalled,
  // not loaded yet) keeps its place, so the choice isn't lost.
  const fill = (select, defaultText) => {
    if (!select) return;
    const opt = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
    const options = [opt("", defaultText), ...list().map((v) => opt(v.voiceURI || v.name, voiceLabel(v, lang())))];
    const name = prefs().voiceName || "";
    if (name && !options.some((o) => o.value === name)) {
      const v = saved();
      options.push(opt(name, v ? voiceLabel(v, lang()) : name));
    }
    select.replaceChildren(...options);
    select.value = name;
  };
  // Whether the saved voice is of the type picked (or unknown yet).
  const savedFits = () => {
    const v = saved();
    return !v || fits(v);
  };
  // One line at a time, in the plugin's own queue: speechSynthesis gets the
  // next only once the last has ended, so the normal path never calls
  // cancel(). WebView2 clips or drops the line spoken right after a cancel,
  // and a cancel before every new line chopped lines mid-word. At most two
  // wait (a burst never runs on long after; the oldest waiting goes, never
  // the one being said). A line whose end never comes (WebView2 sometimes
  // sends none) is let go after about as long as it could take.
  const MAX_WAITING = 2;
  const GAP_MS = 60;            // between lines
  const AFTER_CANCEL_MS = 150;  // before the first line after a cancel
  const waiting = [];
  let current = null;           // kept referenced: Chromium can lose the end of an utterance it collects
  let watchdog = 0;
  let nextTimer = 0;
  let cancelledAt = 0;
  const done = (u) => {
    if (u !== current) return;
    current = null;
    clearTimeout(watchdog);
    schedule(GAP_MS);
  };
  const schedule = (ms) => {
    clearTimeout(nextTimer);
    nextTimer = setTimeout(next, Math.max(ms, cancelledAt + AFTER_CANCEL_MS - Date.now(), 0));
  };
  const next = () => {
    if (!synth || current || !waiting.length) return;
    const text = waiting.shift();
    const p = prefs();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pick();
    if (voice) u.voice = voice;
    u.lang = voice?.lang || lang();
    const rate = Number(p.voiceRate);
    u.rate = VOICE_RATES.includes(rate) ? rate : 1;
    u.pitch = 1;
    u.volume = typeof volumeGain === "function" ? volumeGain(p.volume ?? 100) : 1;
    u.onend = u.onerror = () => done(u);
    current = u;
    // Speech runs about 12 characters a second at rate 1: double that, plus
    // the voice's start-up. If the engine is still talking then, the next
    // line only queues behind it.
    watchdog = setTimeout(() => done(u), 1500 + (text.length * 85) / u.rate);
    if (synth.paused) synth.resume();
    synth.speak(u);
  };
  const stop = () => {
    if (!synth) return;
    waiting.length = 0;
    clearTimeout(nextTimer);
    clearTimeout(watchdog);
    if (current || synth.speaking || synth.pending) {
      current = null;
      cancelledAt = Date.now();
      synth.cancel();
    }
  };
  const say = (text) => {
    const p = prefs();
    if (!synth || !text || Number(p.volume ?? 100) <= 0) return;
    waiting.push(text);
    // Nothing playing: start now (waiting a tick let a burst push out its own first line).
    if (!current && Date.now() - cancelledAt >= AFTER_CANCEL_MS) next();
    else {
      while (waiting.length > MAX_WAITING) waiting.shift();
      if (!current) schedule(0);
    }
  };
  const load = () => {
    all = synth?.getVoices?.() || [];
    onChange?.();
  };
  if (synth) {
    load();
    if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", load);
    else synth.onvoiceschanged = load;
  }
  return { available: !!synth, say, stop, pick, fill, savedFits };
}
