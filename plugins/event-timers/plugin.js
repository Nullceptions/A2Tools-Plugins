// Event Timers: countdowns to the recurring events and scheduled bosses, from
// the game's own schedules (schedule.js), in the player's server time.
//
// The schedules are server time: each Global region's servers keep their own
// clock (NA East is New York time, and so on), and the region comes from the
// server's number (its second digit), told by the meter with the character.
// Resets are one moment on every Global server: 07:00 UTC.

const els = {
  status: document.querySelector(".status"),
  regionLabel: document.querySelector(".regionLabel"),
  regionSelect: document.querySelector(".regionSelect"),
  list: document.querySelector(".events"),
  hidden: document.querySelector(".hidden"),
};

// Each Global region's server clock, by the second digit of a server's number.
const REGIONS = {
  1: "America/New_York",
  2: "America/Los_Angeles",
  3: "Europe/Berlin",
  4: "America/Sao_Paulo",
  5: "Asia/Seoul",
};

// The plugin's own words, in each of the meter's languages.
const UI = {
  en: { serverTime: "Server time", auto: "From your character", regions: ["NA East", "NA West", "Europe", "South America", "Asia"],
        pick: "Log in to a character, or pick your region.", unsupported: "Korean and Taiwanese servers aren't covered yet: pick a region to use its times.",
        now: "now", left: (t) => `${t} left`, in: (t) => `in ${t}`, hide: "Hide", hidden: "Hidden:", elyos: "Elyos", asmodian: "Asmodian" },
  ko: { serverTime: "서버 시간", auto: "캐릭터 기준", regions: ["북미 동부", "북미 서부", "유럽", "남미", "아시아"],
        pick: "캐릭터로 접속하거나 지역을 선택하세요.", unsupported: "한국·대만 서버는 아직 지원하지 않습니다. 지역을 선택하면 해당 시간으로 표시합니다.",
        now: "진행 중", left: (t) => `${t} 남음`, in: (t) => `${t} 후`, hide: "숨기기", hidden: "숨김:", elyos: "천족", asmodian: "마족" },
  ja: { serverTime: "サーバー時間", auto: "キャラクターから", regions: ["北米東部", "北米西部", "ヨーロッパ", "南米", "アジア"],
        pick: "キャラクターでログインするか、地域を選んでください。", unsupported: "韓国・台湾サーバーにはまだ対応していません。地域を選ぶとその時間で表示します。",
        now: "開催中", left: (t) => `残り ${t}`, in: (t) => `${t} 後`, hide: "非表示", hidden: "非表示:", elyos: "天族", asmodian: "魔族" },
  de: { serverTime: "Serverzeit", auto: "Vom Charakter", regions: ["NA Ost", "NA West", "Europa", "Südamerika", "Asien"],
        pick: "Mit einem Charakter einloggen oder Region wählen.", unsupported: "Koreanische und taiwanische Server werden noch nicht unterstützt: Region wählen, um deren Zeiten zu nutzen.",
        now: "jetzt", left: (t) => `noch ${t}`, in: (t) => `in ${t}`, hide: "Ausblenden", hidden: "Ausgeblendet:", elyos: "Elyos", asmodian: "Asmodier" },
  fr: { serverTime: "Heure du serveur", auto: "D'après le personnage", regions: ["NA Est", "NA Ouest", "Europe", "Amérique du Sud", "Asie"],
        pick: "Connectez-vous avec un personnage ou choisissez votre région.", unsupported: "Les serveurs coréens et taïwanais ne sont pas encore pris en charge : choisissez une région pour ses horaires.",
        now: "en cours", left: (t) => `encore ${t}`, in: (t) => `dans ${t}`, hide: "Masquer", hidden: "Masqués :", elyos: "Elyséens", asmodian: "Asmodiens" },
  es: { serverTime: "Hora del servidor", auto: "Según tu personaje", regions: ["NA Este", "NA Oeste", "Europa", "Sudamérica", "Asia"],
        pick: "Entra con un personaje o elige tu región.", unsupported: "Los servidores de Corea y Taiwán aún no están cubiertos: elige una región para usar sus horas.",
        now: "ahora", left: (t) => `quedan ${t}`, in: (t) => `en ${t}`, hide: "Ocultar", hidden: "Ocultos:", elyos: "Elios", asmodian: "Asmodianos" },
  pt: { serverTime: "Hora do servidor", auto: "Pelo personagem", regions: ["NA Leste", "NA Oeste", "Europa", "América do Sul", "Ásia"],
        pick: "Entre com um personagem ou escolha sua região.", unsupported: "Servidores da Coreia e de Taiwan ainda não são cobertos: escolha uma região para usar os horários dela.",
        now: "agora", left: (t) => `faltam ${t}`, in: (t) => `em ${t}`, hide: "Ocultar", hidden: "Ocultos:", elyos: "Elyos", asmodian: "Asmodianos" },
  ru: { serverTime: "Время сервера", auto: "По персонажу", regions: ["СА Восток", "СА Запад", "Европа", "Южная Америка", "Азия"],
        pick: "Войдите персонажем или выберите регион.", unsupported: "Корейские и тайваньские серверы пока не поддерживаются: выберите регион, чтобы видеть его время.",
        now: "идёт", left: (t) => `осталось ${t}`, in: (t) => `через ${t}`, hide: "Скрыть", hidden: "Скрыто:", elyos: "Элийцы", asmodian: "Асмодиане" },
  "zh-Hant": { serverTime: "伺服器時間", auto: "依角色", regions: ["北美東部", "北美西部", "歐洲", "南美", "亞洲"],
        pick: "請登入角色，或選擇地區。", unsupported: "尚未支援韓國與台灣伺服器：選擇地區即可使用其時間。",
        now: "進行中", left: (t) => `剩餘 ${t}`, in: (t) => `${t} 後`, hide: "隱藏", hidden: "已隱藏：", elyos: "天族", asmodian: "魔族" },
  "zh-Hans": { serverTime: "服务器时间", auto: "依角色", regions: ["北美东部", "北美西部", "欧洲", "南美", "亚洲"],
        pick: "请登录角色，或选择地区。", unsupported: "尚未支持韩国与台湾服务器：选择地区即可使用其时间。",
        now: "进行中", left: (t) => `剩余 ${t}`, in: (t) => `${t} 后`, hide: "隐藏", hidden: "已隐藏：", elyos: "天族", asmodian: "魔族" },
};

let language = "en";
let character = null;
let prefs = { region: "auto", hidden: [] };

const ui = () => UI[language] || UI.en;
const text = (k) => EVENT_TEXT[k]?.[language] ?? EVENT_TEXT[k]?.en ?? k;
const savePrefs = () => a2.storage.set("prefs", prefs).catch(() => {});

// The character's server: its region (second digit) and side (first).
const serverRegion = () => {
  const id = Number(character?.serverId);
  if (!(id >= 1000)) return null;
  return Number(String(id)[1]);
};
const serverSide = () => {
  const id = Number(character?.serverId);
  if (!(id >= 1000)) return null;
  return String(id)[0] === "1" ? "elyos" : String(id)[0] === "2" ? "asmodian" : null;
};
const timeZone = () => {
  if (prefs.region !== "auto") return REGIONS[prefs.region] || null;
  return REGIONS[serverRegion()] || null;
};

// A wall-clock time in a time zone, as a moment (ms). The zone's offset is
// read from Intl for that moment, twice, so a time next to a clock change
// lands right.
const partsIn = (tz, ms) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", weekday: "short",
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    y: Number(get("year")), m: Number(get("month")), d: Number(get("day")),
    h: Number(get("hour")), mi: Number(get("minute")), s: Number(get("second")),
    wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
};
const offsetAt = (tz, ms) => {
  const p = partsIn(tz, ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
};
const wallToMs = (tz, y, m, d, minutes) => {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - offsetAt(tz, guess);
  return guess - offsetAt(tz, first);
};

// An event's current or next showing: { start, end } in ms.
const nextOf = (ev, tz, now) => {
  const zone = ev.utc ? "UTC" : tz;
  const runMs = (ev.minutes || 0) * 60_000;
  let best = null;
  for (let back = -1; back <= 8; back++) {
    const p = partsIn(zone, now + back * 86_400_000);
    if (!ev.days.includes(p.wd)) continue;
    for (const start of ev.starts) {
      const at = wallToMs(zone, p.y, p.m, p.d, start);
      const end = at + runMs;
      if ((runMs ? end : at) <= now) continue;
      if (!best || at < best.start) best = { start: at, end };
    }
  }
  return best;
};

// A day or more as "6d 17h" in the meter's language; under that, h:mm:ss.
const unit = (n, u) => {
  try {
    return new Intl.NumberFormat(language, { style: "unit", unit: u, unitDisplay: "narrow" }).format(n);
  } catch {
    return `${n}${u[0]}`;
  }
};
const span = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 86_400) return `${unit(Math.floor(s / 86_400), "day")} ${unit(Math.floor((s % 86_400) / 3600), "hour")}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

function renderRegions() {
  const words = ui();
  els.regionLabel.textContent = words.serverTime;
  const options = [["auto", words.auto], ...Object.keys(REGIONS).map((k) => [k, words.regions[k - 1]])];
  els.regionSelect.replaceChildren(...options.map(([value, label]) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    return o;
  }));
  els.regionSelect.value = String(prefs.region);
}

function render() {
  const words = ui();
  const tz = timeZone();
  const now = Date.now();
  if (!tz) {
    els.status.textContent = serverRegion() === 0 ? words.unsupported : words.pick;
  } else {
    const region = prefs.region !== "auto" ? prefs.region : serverRegion();
    els.status.textContent = `${words.regions[region - 1]} · ${tz.split("/").pop().replace("_", " ")}`;
  }
  const side = serverSide();
  const shown = EVENTS
    .filter((ev) => !ev.side || !side || ev.side === side)
    .filter((ev) => tz || ev.utc)
    .map((ev) => ({ ev, next: nextOf(ev, tz || "UTC", now) }))
    .filter((x) => x.next);
  const visible = shown.filter((x) => !prefs.hidden.includes(x.ev.id)).sort((a, b) => a.next.start - b.next.start);
  const clock = new Intl.DateTimeFormat(language, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  els.list.replaceChildren(...visible.map(({ ev, next }) => {
    const running = next.start <= now;
    const li = document.createElement("li");
    li.classList.toggle("running", running);
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = [ev.name, ...(ev.also || [])].map(text).join(" · ")
      + (ev.side && !side ? ` (${words[ev.side]})` : "");
    const where = document.createElement("span");
    where.className = "where";
    where.textContent = ev.where.map(text).join(", ");
    const when = document.createElement("span");
    when.className = "when";
    const countdown = document.createElement("div");
    countdown.className = "countdown";
    countdown.textContent = running ? `${words.now} · ${words.left(span(next.end - now))}` : words.in(span(next.start - now));
    const at = document.createElement("div");
    at.className = "at";
    at.textContent = clock.format(new Date(next.start));
    when.append(countdown, at);
    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "hide";
    hide.textContent = "×";
    hide.title = words.hide;
    hide.addEventListener("click", () => {
      prefs.hidden = [...new Set([...prefs.hidden, ev.id])];
      savePrefs();
      render();
    });
    li.append(name, when, hide, where);
    return li;
  }));
  const hiddenOnes = shown.filter((x) => prefs.hidden.includes(x.ev.id));
  els.hidden.replaceChildren();
  if (hiddenOnes.length) {
    els.hidden.append(words.hidden);
    for (const { ev } of hiddenOnes) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text(ev.name);
      b.addEventListener("click", () => {
        prefs.hidden = prefs.hidden.filter((id) => id !== ev.id);
        savePrefs();
        render();
      });
      els.hidden.append(b);
    }
  }
}

els.regionSelect.addEventListener("change", () => {
  prefs.region = els.regionSelect.value;
  savePrefs();
  render();
});
a2.on("character", (c) => {
  character = c || null;
  render();
});
a2.on("language", (code) => {
  language = typeof code === "string" ? code : "en";
  renderRegions();
  render();
});
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

(async () => {
  prefs = { ...prefs, ...((await a2.storage.get("prefs").catch(() => null)) || {}) };
  renderRegions();
  render();
  setInterval(render, 1000);
  await a2.ready();
})();
