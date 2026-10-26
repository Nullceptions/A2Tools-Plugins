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

// The built-in voice (kokoro.js): every line the plugin can say, in English,
// made with Kokoro, for computers with no voices of their own (Linux: the
// meter's web view has no speech). Its value in the Voice list, and its name.
const KOKORO = "kokoro";
const KOKORO_LABEL = {
  en: "Built-in (Kokoro, English)", ko: "내장 (Kokoro, 영어)", ja: "内蔵（Kokoro、英語）", de: "Eingebaut (Kokoro, Englisch)",
  fr: "Intégrée (Kokoro, anglais)", es: "Integrada (Kokoro, inglés)", pt: "Integrada (Kokoro, inglês)",
  ru: "Встроенный (Kokoro, английский)", "zh-Hant": "內建（Kokoro，英語）", "zh-Hans": "内置（Kokoro，英语）",
};

// Faster or slower at the same pitch (WSOLA): 30 ms windows laid half over
// each other, each taken from where it best continues the last, within 10 ms
// of where the speed puts it. The search looks at every 4th sample, so a
// line takes a few milliseconds.
function voiceStretch(ctx, buffer, rate) {
  const x = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const N = Math.round(sr * 0.03) & ~1;
  const H = N / 2; // output hop
  const tol = Math.round(sr * 0.01);
  const frames = Math.max(1, Math.floor((x.length / rate - N) / H) + 1);
  const y = new Float32Array((frames - 1) * H + N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  let prev = 0; // input start of the last frame
  for (let k = 0; k < frames; k++) {
    let pos = Math.round(k * H * rate);
    if (k > 0) {
      // The last frame's natural continuation, matched against candidates.
      const want = prev + H;
      let best = 0;
      let bestScore = -Infinity;
      for (let d = -tol; d <= tol; d += 4) {
        const p = pos + d;
        if (p < 0 || p + H > x.length || want + H > x.length) continue;
        let s = 0;
        for (let i = 0; i < H; i += 4) s += x[want + i] * x[p + i];
        if (s > bestScore) {
          bestScore = s;
          best = d;
        }
      }
      pos = Math.max(0, pos + best);
    }
    for (let i = 0; i < N && pos + i < x.length; i++) y[k * H + i] += x[pos + i] * win[i];
    prev = pos;
  }
  const out = ctx.createBuffer(1, y.length, sr);
  out.copyToChannel(y, 0);
  return out;
}

// The built-in voice's player: a line is one clip or several said one after
// the other ("Shugo Festival", "in 5 minutes"), through Web Audio (the page
// may load no audio files, so the clips are decoded from their bytes). The
// same queue as the computer's voices: the one playing and two waiting at
// most.
function makeBuiltInVoice(clips, prefs) {
  const context = () => {
    // sounds.js' context when it's there: one for the page.
    if (typeof audio !== "undefined") {
      audio ||= new AudioContext();
      if (audio.state !== "running") audio.resume().catch(() => {});
      return audio;
    }
    makeBuiltInVoice.ctx ||= new AudioContext();
    return makeBuiltInVoice.ctx;
  };
  const decoded = new Map(); // English text -> Promise<AudioBuffer | null>
  const decode = (text) => {
    if (!decoded.has(text)) {
      const bytes = Uint8Array.from(atob(clips[text]), (c) => c.charCodeAt(0));
      decoded.set(text, context().decodeAudioData(bytes.buffer).catch(() => null));
    }
    return decoded.get(text);
  };
  const lines = new Map(); // "rate|text|text" -> AudioBuffer
  // The clips joined, with a short pause between, at the speed picked.
  const line = async (parts, rate) => {
    const key = `${rate}|${parts.join("|")}`;
    if (lines.has(key)) return lines.get(key);
    const buffers = await Promise.all(parts.map(decode));
    if (buffers.some((b) => !b)) return null;
    const sr = buffers[0].sampleRate;
    const gap = Math.round(sr * 0.05);
    const out = context().createBuffer(1, buffers.reduce((n, b) => n + b.length, 0) + gap * (buffers.length - 1), sr);
    let at = 0;
    for (const b of buffers) {
      out.copyToChannel(b.getChannelData(0), 0, at);
      at += b.length + gap;
    }
    const said = rate === 1 ? out : voiceStretch(context(), out, rate);
    if (lines.size > 100) lines.clear();
    lines.set(key, said);
    return said;
  };
  const MAX_WAITING = 2;
  const waiting = [];
  let playing = null; // { node, until }
  const stop = () => {
    waiting.length = 0;
    const p = playing;
    playing = null;
    // A line still being made has no node yet: next() sees it was cut off.
    if (p?.node) {
      p.node.onended = null;
      try {
        p.node.stop();
      } catch {
        /* not started yet */
      }
    }
  };
  const next = async () => {
    const parts = waiting.shift();
    if (!parts) return;
    const p = prefs();
    const rate = VOICE_RATES.includes(Number(p.voiceRate)) ? Number(p.voiceRate) : 1;
    const slot = { node: null, until: Date.now() + 5000 };
    playing = slot;
    let buffer = null;
    try {
      buffer = await line(parts, rate);
    } catch {
      buffer = null;
    }
    if (playing !== slot) return; // cut off while it was made
    if (!buffer) {
      playing = null;
      return next();
    }
    const ctx = context();
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = typeof volumeGain === "function" ? volumeGain(p.volume ?? 100) : 1;
    node.connect(gain).connect(ctx.destination);
    slot.node = node;
    // A line whose end never comes (the audio output stopped) holds no one up.
    slot.until = Date.now() + buffer.duration * 1000 + 1000;
    node.onended = () => {
      if (playing !== slot) return;
      playing = null;
      setTimeout(next, 60);
    };
    node.start();
  };
  const say = (parts) => {
    if (playing && Date.now() > playing.until) {
      const p = playing;
      playing = null;
      if (p.node) p.node.onended = null;
    }
    waiting.push(parts);
    while (waiting.length > MAX_WAITING) waiting.shift();
    if (!playing) next();
  };
  return { say, stop, has: (parts) => parts.every((t) => t && clips[t]) };
}

// The voices for a plugin. `lang()` is the meter's language; `prefs()` gives
// { voiceName, voiceType, voiceRate, volume }; `onChange()` runs when the
// computer's voices arrive (a moment after the page opens: read before then
// the list is empty, and the first words came in the system's default voice,
// whatever its language).
//
// The built-in voice (window.KOKORO_CLIPS, kokoro.js) speaks when chosen, or
// when the computer has none. On Windows the list is empty for a moment after
// the page opens, so "none" counts only once it has come or 1.5 s have
// passed; meanwhile the computer's default voice speaks.
function makeVoices({ lang, prefs, onChange }) {
  const synth = window.speechSynthesis || null;
  let all = [];
  const clips = window.KOKORO_CLIPS || {};
  const builtIn = Object.keys(clips).length ? makeBuiltInVoice(clips, prefs) : null;
  let settled = false;
  setTimeout(() => {
    settled = true;
    if (builtIn && !all.length) onChange?.();
  }, 1500);
  const usesBuiltIn = () => !!builtIn && (prefs().voiceName === KOKORO || !synth || (settled && !all.length));
  const typeOf = () => (VOICE_TYPES.includes(prefs().voiceType) ? prefs().voiceType : "any");
  const fits = (v) => typeOf() === "any" || voiceGender(v) === typeOf();
  // The built-in voice is Kokoro's af_heart: female.
  const builtInFits = () => typeOf() !== "male";
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
    return name && name !== KOKORO ? all.find((x) => x.voiceURI === name || x.name === name) || null : null;
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
  // The Voice list: Default first, then the built-in voice. A saved voice
  // not listed (uninstalled, not loaded yet) keeps its place, so the choice
  // isn't lost.
  const fill = (select, defaultText) => {
    if (!select) return;
    const opt = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
    const own = builtIn && builtInFits() ? [opt(KOKORO, `${KOKORO_LABEL[lang()] || KOKORO_LABEL.en} ♀`)] : [];
    const options = [opt("", defaultText), ...own, ...list().map((v) => opt(v.voiceURI || v.name, voiceLabel(v, lang())))];
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
    if (prefs().voiceName === KOKORO) return builtInFits();
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
    builtIn?.stop();
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
  // `parts`: the line in English, as the built-in voice's clips (["Shugo
  // Festival", "in 5 minutes"]); `text` alone when it is one. A line the
  // built-in voice has no clips for goes to the computer's voices, if any.
  const say = (text, parts) => {
    const p = prefs();
    if (!text || Number(p.volume ?? 100) <= 0) return;
    if (usesBuiltIn()) {
      const en = parts || [text];
      if (builtIn.has(en)) return builtIn.say(en);
    }
    if (!synth) return;
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
    if (all.length) settled = true;
    onChange?.();
  };
  if (synth) {
    load();
    if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", load);
    else synth.onvoiceschanged = load;
  }
  return { available: !!synth || !!builtIn, say, stop, pick, fill, savedFits };
}
