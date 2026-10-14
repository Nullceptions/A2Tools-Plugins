// Event Timers: countdowns to the recurring events and scheduled bosses, from
// the game's own schedules (schedule.js), in the player's server time.
//
// The schedules are server time: each Global region's servers keep their own
// clock (NA East is New York time, and so on), and the region comes from the
// server's number (its second digit), told by the meter with the character.
// Resets are one moment on every Global server: 07:00 UTC.
//
// Alerts: each event can sound an alert a set time before it starts (or as
// it starts), once per showing, with a sound of the player's choosing and,
// if they like, the window brought up (plugin API 2).

const els = {
  status: document.querySelector(".status"),
  regionLabel: document.querySelector(".regionLabel"),
  regionSelect: document.querySelector(".regionSelect"),
  list: document.querySelector(".events"),
  hidden: document.querySelector(".hidden"),
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    timers: document.querySelector(".view.timers"),
    alerts: document.querySelector(".view.alerts"),
    settings: document.querySelector(".view.settings"),
  },
  zoneLabel: document.querySelector(".zoneLabel"),
  zoneSelect: document.querySelector(".zoneSelect"),
  sound: document.querySelector(".sound"),
  soundLabel: document.querySelector(".soundLabel"),
  test: document.querySelector(".testSound"),
  pop: document.querySelector(".pop"),
  popLabel: document.querySelector(".popLabel"),
  alertList: document.querySelector(".alertList"),
};

// How long before an event its alert goes off, in minutes (0 = as it starts).
const LEADS = [0, 1, 2, 3, 4, 5, 10, 15, 20, 30, 45, 60];
const DEFAULT_LEAD = 5;
// While the game is closed an alert can come earlier, to leave time to start
// it and log in: by default a quarter of an hour.
const DEFAULT_CLOSED_LEAD = 15;
// The time zone this computer is set to, for showing times.
const SYSTEM_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
})();
const ALL_ZONES = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
})();
const SOUND_ORDER = ["chime", "bell", "sparkle", "ping", "soft", "gong", "horn", "harp", "alarm"];

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

// The alerts' words, in each of the meter's languages.
const ALERT_UI = {
  en: { closed: "While AION2 is closed", settings: "Settings", server: "Server", showIn: "Show times in", systemTime: (z) => `This computer's time (${z})`, serverTime: "Server time", enable: "Alert",
        timers: "Timers", alerts: "Alerts", sound: "Sound", play: "Play", none: "None", pop: "Show this window when an alert goes off",
        off: "Off", atStart: "As it starts", before: (n) => `${n} min before`, soon: (name, n) => `${name} in ${n} min`, now: (name) => `${name} is starting`,
        sounds: { chime: "Chime", bell: "Bell", sparkle: "Sparkle", ping: "Ping", soft: "Soft", gong: "Gong", horn: "Horn", harp: "Harp", alarm: "Alarm" } },
  ko: { closed: "AION2가 꺼져 있을 때", settings: "설정", server: "서버", showIn: "시간 표시", systemTime: (z) => `이 컴퓨터 시간 (${z})`, serverTime: "서버 시간", enable: "알림",
        timers: "타이머", alerts: "알림", sound: "소리", play: "재생", none: "없음", pop: "알림이 울리면 이 창 표시",
        off: "끔", atStart: "시작할 때", before: (n) => `${n}분 전`, soon: (name, n) => `${name} ${n}분 전`, now: (name) => `${name} 시작`,
        sounds: { chime: "차임", bell: "종", sparkle: "반짝임", ping: "핑", soft: "부드러움", gong: "징", horn: "뿔피리", harp: "하프", alarm: "경보" } },
  ja: { closed: "AION2を閉じているとき", settings: "設定", server: "サーバー", showIn: "時刻の表示", systemTime: (z) => `このPCの時刻（${z}）`, serverTime: "サーバー時間", enable: "通知",
        timers: "タイマー", alerts: "通知", sound: "サウンド", play: "再生", none: "なし", pop: "通知時にこのウィンドウを表示",
        off: "オフ", atStart: "開始時", before: (n) => `${n}分前`, soon: (name, n) => `${name}まであと${n}分`, now: (name) => `${name}開始`,
        sounds: { chime: "チャイム", bell: "ベル", sparkle: "きらめき", ping: "ピン", soft: "ソフト", gong: "銅鑼", horn: "ホルン", harp: "ハープ", alarm: "アラーム" } },
  de: { closed: "Wenn AION2 geschlossen ist", settings: "Einstellungen", server: "Server", showIn: "Zeiten zeigen in", systemTime: (z) => `Zeit dieses Computers (${z})`, serverTime: "Serverzeit", enable: "Alarm",
        timers: "Timer", alerts: "Alarme", sound: "Ton", play: "Abspielen", none: "Keiner", pop: "Dieses Fenster bei einem Alarm zeigen",
        off: "Aus", atStart: "Zum Start", before: (n) => `${n} Min. vorher`, soon: (name, n) => `${name} in ${n} Min.`, now: (name) => `${name} beginnt`,
        sounds: { chime: "Glockenspiel", bell: "Glocke", sparkle: "Funkeln", ping: "Ping", soft: "Sanft", gong: "Gong", horn: "Horn", harp: "Harfe", alarm: "Alarm" } },
  fr: { closed: "Quand AION2 est fermé", settings: "Réglages", server: "Serveur", showIn: "Afficher les heures en", systemTime: (z) => `Heure de cet ordinateur (${z})`, serverTime: "Heure du serveur", enable: "Alerte",
        timers: "Minuteurs", alerts: "Alertes", sound: "Son", play: "Écouter", none: "Aucun", pop: "Afficher cette fenêtre lors d'une alerte",
        off: "Désactivée", atStart: "Au début", before: (n) => `${n} min avant`, soon: (name, n) => `${name} dans ${n} min`, now: (name) => `${name} commence`,
        sounds: { chime: "Carillon", bell: "Cloche", sparkle: "Scintillement", ping: "Ping", soft: "Doux", gong: "Gong", horn: "Cor", harp: "Harpe", alarm: "Alarme" } },
  es: { closed: "Con AION2 cerrado", settings: "Ajustes", server: "Servidor", showIn: "Mostrar horas en", systemTime: (z) => `Hora de este equipo (${z})`, serverTime: "Hora del servidor", enable: "Alerta",
        timers: "Temporizadores", alerts: "Alertas", sound: "Sonido", play: "Reproducir", none: "Ninguno", pop: "Mostrar esta ventana cuando suene una alerta",
        off: "Desactivada", atStart: "Al empezar", before: (n) => `${n} min antes`, soon: (name, n) => `${name} en ${n} min`, now: (name) => `Empieza ${name}`,
        sounds: { chime: "Campanilla", bell: "Campana", sparkle: "Destello", ping: "Ping", soft: "Suave", gong: "Gong", horn: "Cuerno", harp: "Arpa", alarm: "Alarma" } },
  pt: { closed: "Com o AION2 fechado", settings: "Configurações", server: "Servidor", showIn: "Mostrar horários em", systemTime: (z) => `Hora deste computador (${z})`, serverTime: "Hora do servidor", enable: "Alerta",
        timers: "Timers", alerts: "Alertas", sound: "Som", play: "Tocar", none: "Nenhum", pop: "Mostrar esta janela quando um alerta tocar",
        off: "Desligado", atStart: "Ao começar", before: (n) => `${n} min antes`, soon: (name, n) => `${name} em ${n} min`, now: (name) => `${name} está começando`,
        sounds: { chime: "Carrilhão", bell: "Sino", sparkle: "Brilho", ping: "Ping", soft: "Suave", gong: "Gongo", horn: "Trompa", harp: "Harpa", alarm: "Alarme" } },
  ru: { closed: "Когда AION2 закрыт", settings: "Настройки", server: "Сервер", showIn: "Показывать время", systemTime: (z) => `Время этого компьютера (${z})`, serverTime: "Время сервера", enable: "Оповещать",
        timers: "Таймеры", alerts: "Оповещения", sound: "Звук", play: "Прослушать", none: "Нет", pop: "Показывать это окно при оповещении",
        off: "Выкл.", atStart: "При начале", before: (n) => `за ${n} мин`, soon: (name, n) => `${name} через ${n} мин`, now: (name) => `${name} начинается`,
        sounds: { chime: "Перезвон", bell: "Колокол", sparkle: "Искры", ping: "Пинг", soft: "Мягкий", gong: "Гонг", horn: "Рог", harp: "Арфа", alarm: "Тревога" } },
  "zh-Hant": { closed: "AION2 關閉時", settings: "設定", server: "伺服器", showIn: "時間顯示", systemTime: (z) => `本機時間（${z}）`, serverTime: "伺服器時間", enable: "提醒",
        timers: "計時器", alerts: "提醒", sound: "音效", play: "播放", none: "無", pop: "提醒時顯示此視窗",
        off: "關閉", atStart: "開始時", before: (n) => `${n} 分鐘前`, soon: (name, n) => `${name} ${n} 分鐘後開始`, now: (name) => `${name} 開始`,
        sounds: { chime: "鐘聲", bell: "鈴聲", sparkle: "閃爍", ping: "叮", soft: "柔和", gong: "銅鑼", horn: "號角", harp: "豎琴", alarm: "警報" } },
  "zh-Hans": { closed: "AION2 关闭时", settings: "设置", server: "服务器", showIn: "时间显示", systemTime: (z) => `本机时间（${z}）`, serverTime: "服务器时间", enable: "提醒",
        timers: "计时器", alerts: "提醒", sound: "音效", play: "播放", none: "无", pop: "提醒时显示此窗口",
        off: "关闭", atStart: "开始时", before: (n) => `${n} 分钟前`, soon: (name, n) => `${name} ${n} 分钟后开始`, now: (name) => `${name} 开始`,
        sounds: { chime: "钟声", bell: "铃声", sparkle: "闪烁", ping: "叮", soft: "柔和", gong: "铜锣", horn: "号角", harp: "竖琴", alarm: "警报" } },
};

let language = "en";
let character = null;
// Whether AION2 is open, as the meter tells it; null on meters that don't
// say, taken as open.
let gameRunning = null;
// alerts: event id -> minutes before (0 = as it starts); absent = off.
// leads: the lead chosen per event, kept while its alert is off.
// closedLeads: event id -> minutes before while the game is closed, or -1 for
// no alert then; absent = DEFAULT_CLOSED_LEAD.
// display: "system" (this computer's zone), "server", or a zone name.
// lastServer: the last character's server, kept for when nobody is logged in.
let prefs = { region: "auto", hidden: [], alerts: {}, leads: {}, closedLeads: {}, sound: "chime", pop: false, tab: "timers",
  display: "system", lastServer: 0 };

const ui = () => UI[language] || UI.en;
const aui = () => ALERT_UI[language] || ALERT_UI.en;
const text = (k) => EVENT_TEXT[k]?.[language] ?? EVENT_TEXT[k]?.en ?? k;
const savePrefs = () => a2.storage.set("prefs", prefs).catch(() => {});

// The character's server, or the last one seen: the game may be closed, the
// alerts still wanted.
const serverId = () => Number(character?.serverId) || Number(prefs.lastServer) || 0;
// The server's region (second digit) and side (first).
const serverRegion = () => {
  const id = serverId();
  if (!(id >= 1000)) return null;
  return Number(String(id)[1]);
};
const serverSide = () => {
  const id = serverId();
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
  const a = aui();
  els.regionLabel.textContent = a.server;
  els.zoneLabel.textContent = a.showIn;
  const zones = [["system", a.systemTime(SYSTEM_ZONE || "?")], ["server", a.serverTime],
    ...ALL_ZONES.map((z) => [z, z.replaceAll("_", " ")])];
  els.zoneSelect.replaceChildren(...zones.map(([value, label]) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    return o;
  }));
  els.zoneSelect.value = prefs.display;
  if (els.zoneSelect.value !== prefs.display) els.zoneSelect.value = "system";
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
  const shownZone = prefs.display === "server" ? tz || undefined : prefs.display === "system" ? undefined : prefs.display;
  let clock;
  try {
    clock = new Intl.DateTimeFormat(language, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: shownZone });
  } catch {
    clock = new Intl.DateTimeFormat(language, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  els.list.replaceChildren(...visible.map(({ ev, next }) => {
    const running = next.start <= now;
    const li = document.createElement("li");
    li.classList.toggle("running", running);
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = (ev.id in prefs.alerts ? "🔔 " : "") + [ev.name, ...(ev.also || [])].map(text).join(" · ")
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

// The events this player sees (their side's, or both before they log in).
const eventsShown = () => {
  const side = serverSide();
  return EVENTS.filter((ev) => !ev.side || !side || ev.side === side);
};

function renderTabs() {
  const words = aui();
  for (const tab of els.tabs) {
    tab.textContent = words[tab.dataset.tab];
    tab.setAttribute("aria-selected", String(tab.dataset.tab === prefs.tab));
  }
  for (const [name, view] of Object.entries(els.views)) view.hidden = name !== prefs.tab;
}

function renderAlerts() {
  const words = aui();
  els.soundLabel.textContent = words.sound;
  els.test.textContent = words.play;
  els.popLabel.textContent = words.pop;
  els.pop.checked = !!prefs.pop;
  els.sound.replaceChildren(...[...SOUND_ORDER, "off"].map((value) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = value === "off" ? words.none : words.sounds[value];
    return o;
  }));
  els.sound.value = prefs.sound;
  const side = serverSide();
  els.alertList.replaceChildren(...eventsShown().map((ev) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = [ev.name, ...(ev.also || [])].map(text).join(" · ") + (ev.side && !side ? ` (${ui()[ev.side]})` : "");
    const on = document.createElement("input");
    on.type = "checkbox";
    on.className = "alertOn";
    on.title = words.enable;
    on.checked = ev.id in prefs.alerts;
    const lead = document.createElement("select");
    lead.className = "lead";
    lead.append(...LEADS.map((n) => {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = n ? words.before(n) : words.atStart;
      return o;
    }));
    lead.value = String(prefs.alerts[ev.id] ?? prefs.leads[ev.id] ?? DEFAULT_LEAD);
    lead.disabled = !on.checked;
    // The same alert while AION2 is closed: earlier, or not at all.
    const closed = document.createElement("select");
    closed.className = "lead";
    closed.append(...[-1, ...LEADS].map((n) => {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = n < 0 ? words.off : n ? words.before(n) : words.atStart;
      return o;
    }));
    closed.value = String(prefs.closedLeads[ev.id] ?? DEFAULT_CLOSED_LEAD);
    closed.disabled = !on.checked;
    const apply = () => {
      prefs.leads[ev.id] = Number(lead.value);
      prefs.closedLeads[ev.id] = Number(closed.value);
      if (on.checked) prefs.alerts[ev.id] = Number(lead.value);
      else delete prefs.alerts[ev.id];
      lead.disabled = closed.disabled = !on.checked;
      savePrefs();
      render();
    };
    on.addEventListener("change", apply);
    lead.addEventListener("change", apply);
    closed.addEventListener("change", apply);
    const pick = document.createElement("span");
    pick.className = "pick";
    pick.append(on, lead);
    const closedRow = document.createElement("span");
    closedRow.className = "closedRow";
    const closedLabel = document.createElement("span");
    closedLabel.textContent = words.closed;
    closedRow.append(closedLabel, closed);
    li.append(name, pick, closedRow);
    return li;
  }));
}

// Alerts: each goes off once, when its moment (the start less its lead)
// passes between one check and the next. Opening the window after the
// moment doesn't sound it late.
let lastCheck = Date.now();
const fired = new Set();
function checkAlerts(now) {
  const tz = timeZone();
  const words = aui();
  for (const ev of eventsShown()) {
    if (!(ev.id in prefs.alerts) || (!tz && !ev.utc)) continue;
    // While the game is closed, that lead instead (or none).
    const closedNow = gameRunning === false;
    const minutes = closedNow ? Number(prefs.closedLeads[ev.id] ?? DEFAULT_CLOSED_LEAD) : prefs.alerts[ev.id];
    if (!(minutes >= 0)) continue;
    const lead = minutes * 60_000;
    // The showing that is next once the lead is counted.
    const next = nextOf(ev, tz || "UTC", lastCheck + lead - 1);
    if (!next) continue;
    const at = next.start - lead;
    const key = `${closedNow ? "closed" : "open"}:${ev.id}@${next.start}`;
    if (at > lastCheck && at <= now && !fired.has(key)) {
      fired.add(key);
      const name = text(ev.name);
      if (prefs.sound !== "off") playSound(prefs.sound);
      a2.notify(lead ? words.soon(name, minutes) : words.now(name)).catch(() => {});
      if (prefs.pop && a2.window && typeof a2.window.show === "function") a2.window.show().catch(() => {});
    }
  }
  lastCheck = now;
}

for (const tab of els.tabs) {
  tab.addEventListener("click", () => {
    prefs.tab = tab.dataset.tab;
    savePrefs();
    renderTabs();
  });
}
els.sound.addEventListener("change", () => {
  prefs.sound = els.sound.value;
  savePrefs();
  playSound(prefs.sound);
});
els.test.addEventListener("click", () => playSound(els.sound.value));
els.pop.addEventListener("change", () => {
  prefs.pop = els.pop.checked;
  savePrefs();
});

els.zoneSelect.addEventListener("change", () => {
  prefs.display = els.zoneSelect.value;
  savePrefs();
  render();
});
els.regionSelect.addEventListener("change", () => {
  prefs.region = els.regionSelect.value;
  savePrefs();
  render();
});
a2.on("character", (c) => {
  character = c || null;
  const id = Number(character?.serverId);
  if (id >= 1000 && id !== Number(prefs.lastServer)) {
    prefs.lastServer = id;
    savePrefs();
  }
  renderAlerts();
  render();
});
a2.on("language", (code) => {
  language = typeof code === "string" ? code : "en";
  renderRegions();
  renderTabs();
  renderAlerts();
  render();
});

// Whether AION2 is open (meter 2.0.65 on).
a2.on("game", (g) => {
  gameRunning = typeof g?.running === "boolean" ? g.running : null;
});

a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

(async () => {
  prefs = { ...prefs, ...((await a2.storage.get("prefs").catch(() => null)) || {}) };
  prefs.closedLeads = prefs.closedLeads || {};
  renderRegions();
  renderTabs();
  renderAlerts();
  render();
  lastCheck = Date.now();
  setInterval(() => {
    const now = Date.now();
    checkAlerts(now);
    render();
  }, 1000);
  await a2.ready();
})();
