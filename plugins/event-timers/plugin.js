// Event Timers: countdowns to the recurring events, the scheduled bosses and
// the field bosses, in the player's server time, with alerts before the ones
// they choose.
//
// The schedules are the game's own (schedule.js), in server time: each Global
// region's servers keep their own clock (NA East is New York time, and so on),
// and the region comes from the server's number (its second digit), told by
// the meter with the character and remembered for when the game is closed.
// Resets are one moment on every Global server: 07:00 UTC.
//
// Field bosses respawn a while after each kill: their timers come from what
// players' meters read off the in-game map, shared through a2tools.app
// (a2.bossTimers, meter 2.0.65 on), fetched when the window opens and every
// 15 minutes.
//
// Alerts: each event or boss can sound an alert a set time before it starts,
// once per showing, and another lead while AION2 is closed (to leave time to
// start it and log in). The sound repeats as often as chosen, until muted from
// the alert's banner.

const $ = (selector) => document.querySelector(selector);
const els = {
  status: $(".status"),
  resets: $(".resets"),
  banner: $(".banner"),
  bannerText: $(".bannerText"),
  mute: $(".mute"),
  dismiss: $(".dismiss"),
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    events: $(".view.events"),
    bosses: $(".view.bosses"),
    alerts: $(".view.alerts"),
    settings: $(".view.settings"),
  },
  events: $(".eventList"),
  hidden: $(".hidden"),
  scheduledHead: $(".scheduledHead"),
  scheduled: $(".scheduledList"),
  fieldHead: $(".fieldHead"),
  fieldNote: $(".fieldNote"),
  field: $(".fieldList"),
  soundLabel: $(".soundLabel"),
  sound: $(".sound"),
  test: $(".testSound"),
  repeatLabel: $(".repeatLabel"),
  repeat: $(".repeat"),
  pop: $(".pop"),
  popLabel: $(".popLabel"),
  alertList: $(".alertList"),
  regionLabel: $(".regionLabel"),
  regionSelect: $(".regionSelect"),
  zoneLabel: $(".zoneLabel"),
  zoneSelect: $(".zoneSelect"),
};

// How long before an event its alert goes off, in minutes (0 = as it starts).
const LEADS = [0, 1, 2, 3, 4, 5, 10, 15, 20, 30, 45, 60];
const DEFAULT_LEAD = 5;
// While the game is closed an alert can come earlier, to leave time to start
// it and log in: by default a quarter of an hour.
const DEFAULT_CLOSED_LEAD = 15;
// How many times an alert's sound plays; 0 = until muted (for at most
// UNTIL_MUTED_MS).
const REPEATS = [1, 2, 3, 5, 10, 0];
const UNTIL_MUTED_MS = 5 * 60_000;
// The alert sounds, in the order the list shows them (sounds.js).
const SOUND_ORDER = ["chime", "bell", "sparkle", "ping", "soft", "gong", "horn", "harp", "alarm"];
// The feed of field boss timers: read this often.
const FEED_EVERY_MS = 15 * 60_000;
// "All field bosses" in the alert list.
const ALL_FIELD = "field:*";
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

// The words added with the tabs, the field bosses and repeating alerts.
const MORE_UI = {
  en: { events: "Events", bosses: "Bosses", region: "Region", daily: "Daily reset", weekly: "Weekly reset",
        scheduled: "Scheduled bosses", field: "Field bosses", fieldNote: "Shared by players' meters as they open their map.",
        noFeed: "Field boss timers need meter 2.0.65 or later.", feedFailed: "Couldn't read the field boss timers.",
        noServer: "Log in to a character to see your server's field bosses.", up: "Up", upFor: (t) => `up ${t}`,
        due: "Due", unknown: "No report yet", seen: (t) => `reported ${t} ago`, allField: "All field bosses",
        repeat: "Repeat", once: "Once", times: (n) => `${n} times`, untilMuted: "Until muted", mute: "Mute", dismiss: "Dismiss",
        bossSoon: (name, n) => `${name} back in ${n} min`, bossNow: (name) => `${name} is back` },
  ko: { events: "이벤트", bosses: "보스", region: "지역", daily: "일일 초기화", weekly: "주간 초기화",
        scheduled: "정기 보스", field: "필드 보스", fieldNote: "플레이어들이 지도를 열 때 미터가 공유한 정보입니다.",
        noFeed: "필드 보스 타이머는 미터 2.0.65 이상이 필요합니다.", feedFailed: "필드 보스 타이머를 읽지 못했습니다.",
        noServer: "캐릭터로 접속하면 서버의 필드 보스가 표시됩니다.", up: "출현", upFor: (t) => `${t} 전 출현`,
        due: "곧 출현", unknown: "아직 정보 없음", seen: (t) => `${t} 전 보고`, allField: "모든 필드 보스",
        repeat: "반복", once: "1회", times: (n) => `${n}회`, untilMuted: "끌 때까지", mute: "소리 끄기", dismiss: "닫기",
        bossSoon: (name, n) => `${name} ${n}분 후 출현`, bossNow: (name) => `${name} 출현` },
  ja: { events: "イベント", bosses: "ボス", region: "地域", daily: "デイリーリセット", weekly: "ウィークリーリセット",
        scheduled: "定時ボス", field: "フィールドボス", fieldNote: "プレイヤーがマップを開いたときにメーターが共有した情報です。",
        noFeed: "フィールドボスのタイマーにはメーター 2.0.65 以降が必要です。", feedFailed: "フィールドボスのタイマーを読み込めませんでした。",
        noServer: "キャラクターでログインするとサーバーのフィールドボスが表示されます。", up: "出現中", upFor: (t) => `${t}前から出現`,
        due: "まもなく", unknown: "情報なし", seen: (t) => `${t}前に報告`, allField: "すべてのフィールドボス",
        repeat: "繰り返し", once: "1回", times: (n) => `${n}回`, untilMuted: "ミュートするまで", mute: "ミュート", dismiss: "閉じる",
        bossSoon: (name, n) => `${name}まであと${n}分`, bossNow: (name) => `${name}出現` },
  de: { events: "Events", bosses: "Bosse", region: "Region", daily: "Täglicher Reset", weekly: "Wöchentlicher Reset",
        scheduled: "Geplante Bosse", field: "Feldbosse", fieldNote: "Von den Metern der Spieler geteilt, wenn sie ihre Karte öffnen.",
        noFeed: "Feldboss-Timer brauchen Meter 2.0.65 oder neuer.", feedFailed: "Die Feldboss-Timer konnten nicht gelesen werden.",
        noServer: "Mit einem Charakter einloggen, um die Feldbosse deines Servers zu sehen.", up: "Da", upFor: (t) => `seit ${t}`,
        due: "Fällig", unknown: "Noch keine Meldung", seen: (t) => `vor ${t} gemeldet`, allField: "Alle Feldbosse",
        repeat: "Wiederholen", once: "Einmal", times: (n) => `${n}-mal`, untilMuted: "Bis stumm", mute: "Stumm", dismiss: "Schließen",
        bossSoon: (name, n) => `${name} in ${n} Min. zurück`, bossNow: (name) => `${name} ist zurück` },
  fr: { events: "Événements", bosses: "Boss", region: "Région", daily: "Réinitialisation quotidienne", weekly: "Réinitialisation hebdomadaire",
        scheduled: "Boss programmés", field: "Boss de terrain", fieldNote: "Partagés par les meters des joueurs quand ils ouvrent leur carte.",
        noFeed: "Les minuteurs des boss de terrain demandent le meter 2.0.65 ou plus récent.", feedFailed: "Impossible de lire les minuteurs des boss de terrain.",
        noServer: "Connectez-vous avec un personnage pour voir les boss de terrain de votre serveur.", up: "Présent", upFor: (t) => `depuis ${t}`,
        due: "Imminent", unknown: "Pas encore signalé", seen: (t) => `signalé il y a ${t}`, allField: "Tous les boss de terrain",
        repeat: "Répéter", once: "Une fois", times: (n) => `${n} fois`, untilMuted: "Jusqu'à coupure", mute: "Couper", dismiss: "Fermer",
        bossSoon: (name, n) => `${name} de retour dans ${n} min`, bossNow: (name) => `${name} est de retour` },
  es: { events: "Eventos", bosses: "Jefes", region: "Región", daily: "Reinicio diario", weekly: "Reinicio semanal",
        scheduled: "Jefes programados", field: "Jefes de campo", fieldNote: "Compartidos por los medidores de los jugadores al abrir su mapa.",
        noFeed: "Los temporizadores de jefes de campo necesitan el medidor 2.0.65 o posterior.", feedFailed: "No se pudieron leer los temporizadores de jefes de campo.",
        noServer: "Entra con un personaje para ver los jefes de campo de tu servidor.", up: "Activo", upFor: (t) => `hace ${t}`,
        due: "Inminente", unknown: "Sin informes", seen: (t) => `informado hace ${t}`, allField: "Todos los jefes de campo",
        repeat: "Repetir", once: "Una vez", times: (n) => `${n} veces`, untilMuted: "Hasta silenciar", mute: "Silenciar", dismiss: "Cerrar",
        bossSoon: (name, n) => `${name} vuelve en ${n} min`, bossNow: (name) => `${name} ha vuelto` },
  pt: { events: "Eventos", bosses: "Chefes", region: "Região", daily: "Reinício diário", weekly: "Reinício semanal",
        scheduled: "Chefes agendados", field: "Chefes de campo", fieldNote: "Compartilhados pelos medidores dos jogadores ao abrir o mapa.",
        noFeed: "Os timers de chefes de campo precisam do medidor 2.0.65 ou mais novo.", feedFailed: "Não foi possível ler os timers de chefes de campo.",
        noServer: "Entre com um personagem para ver os chefes de campo do seu servidor.", up: "Ativo", upFor: (t) => `há ${t}`,
        due: "Iminente", unknown: "Sem relatos ainda", seen: (t) => `relatado há ${t}`, allField: "Todos os chefes de campo",
        repeat: "Repetir", once: "Uma vez", times: (n) => `${n} vezes`, untilMuted: "Até silenciar", mute: "Silenciar", dismiss: "Fechar",
        bossSoon: (name, n) => `${name} volta em ${n} min`, bossNow: (name) => `${name} voltou` },
  ru: { events: "События", bosses: "Боссы", region: "Регион", daily: "Ежедневный сброс", weekly: "Еженедельный сброс",
        scheduled: "Боссы по расписанию", field: "Полевые боссы", fieldNote: "Делятся метры игроков, когда те открывают карту.",
        noFeed: "Для таймеров полевых боссов нужен метр 2.0.65 или новее.", feedFailed: "Не удалось прочитать таймеры полевых боссов.",
        noServer: "Войдите персонажем, чтобы видеть полевых боссов своего сервера.", up: "На месте", upFor: (t) => `уже ${t}`,
        due: "Вот-вот", unknown: "Пока нет данных", seen: (t) => `данные ${t} назад`, allField: "Все полевые боссы",
        repeat: "Повтор", once: "Один раз", times: (n) => `${n} раз`, untilMuted: "Пока не выключить", mute: "Выключить звук", dismiss: "Закрыть",
        bossSoon: (name, n) => `${name} через ${n} мин`, bossNow: (name) => `${name} появился` },
  "zh-Hant": { events: "活動", bosses: "首領", region: "地區", daily: "每日重置", weekly: "每週重置",
        scheduled: "定時首領", field: "野外首領", fieldNote: "由玩家開啟地圖時其計量器分享。",
        noFeed: "野外首領計時需要計量器 2.0.65 以上。", feedFailed: "無法讀取野外首領計時。",
        noServer: "登入角色即可查看伺服器的野外首領。", up: "已出現", upFor: (t) => `${t} 前出現`,
        due: "即將出現", unknown: "尚無回報", seen: (t) => `${t} 前回報`, allField: "所有野外首領",
        repeat: "重複", once: "一次", times: (n) => `${n} 次`, untilMuted: "直到靜音", mute: "靜音", dismiss: "關閉",
        bossSoon: (name, n) => `${name} ${n} 分鐘後出現`, bossNow: (name) => `${name} 已出現` },
  "zh-Hans": { events: "活动", bosses: "首领", region: "地区", daily: "每日重置", weekly: "每周重置",
        scheduled: "定时首领", field: "野外首领", fieldNote: "由玩家打开地图时其计量器分享。",
        noFeed: "野外首领计时需要计量器 2.0.65 以上。", feedFailed: "无法读取野外首领计时。",
        noServer: "登录角色即可查看服务器的野外首领。", up: "已出现", upFor: (t) => `${t} 前出现`,
        due: "即将出现", unknown: "尚无回报", seen: (t) => `${t} 前回报`, allField: "所有野外首领",
        repeat: "重复", once: "一次", times: (n) => `${n} 次`, untilMuted: "直到静音", mute: "静音", dismiss: "关闭",
        bossSoon: (name, n) => `${name} ${n} 分钟后出现`, bossNow: (name) => `${name} 已出现` },
};

let language = "en";
let character = null;
// Whether AION2 is open, as the meter tells it; null on meters that don't
// say, taken as open.
let gameRunning = null;
// alerts: id -> minutes before (0 = as it starts); absent = off. Ids are an
// event's, "field:<world-map id>" for a field boss, ALL_FIELD for all of them.
// leads: the lead chosen per id, kept while its alert is off.
// closedLeads: id -> minutes before while the game is closed, or -1 for no
// alert then; absent = DEFAULT_CLOSED_LEAD.
// repeat: how many times the sound plays (0 = until muted).
// display: "system" (this computer's zone), "server", or a zone name.
// lastServer: the last character's server, kept for when nobody is logged in.
let prefs = { region: "auto", hidden: [], alerts: {}, leads: {}, closedLeads: {}, sound: "chime", repeat: 1, pop: false,
  tab: "events", display: "system", lastServer: 0 };
// The field boss timers last read: { server, bosses, at } or { error }.
let feed = null;

const ui = () => ({ ...(UI[language] || UI.en), ...(MORE_UI[language] || MORE_UI.en) });
const aui = () => ALERT_UI[language] || ALERT_UI.en;
const text = (k) => EVENT_TEXT[k]?.[language] ?? EVENT_TEXT[k]?.en ?? k;
const savePrefs = () => a2.storage.set("prefs", prefs).catch(() => {});
const option = (value, label) => {
  const o = document.createElement("option");
  o.value = String(value);
  o.textContent = label;
  return o;
};

// The character's server, or the last one seen: the game may be closed, the
// alerts still wanted.
const serverId = () => Number(character?.serverId) || Number(prefs.lastServer) || 0;
const serverName = () => {
  const names = SERVERS[String(serverId())];
  return names ? names[language] || names.en : "";
};
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
const region = () => (prefs.region !== "auto" ? Number(prefs.region) : serverRegion());
const timeZone = () => REGIONS[region()] || null;

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
// A rough age: "12 min", "3 h".
const age = (ms) => {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min >= 120 ? unit(Math.round(min / 60), "hour") : unit(min, "minute");
};
// Times as the player chose to see them: this computer's zone, the server's,
// or any other.
const clock = () => {
  const tz = timeZone();
  const zone = prefs.display === "server" ? tz || undefined : prefs.display === "system" ? undefined : prefs.display;
  const opts = { weekday: "short", hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat(language, { ...opts, timeZone: zone });
  } catch {
    return new Intl.DateTimeFormat(language, opts);
  }
};

// The scheduled events and bosses this player sees: their side's, or both
// before they log in; resets apart.
const scheduled = (kind) => {
  const side = serverSide();
  return EVENTS.filter((ev) => (kind === "boss" ? ev.kind === "boss" : ev.kind !== "boss" && ev.kind !== "reset"))
    .filter((ev) => !ev.side || !side || ev.side === side);
};
const eventName = (ev) => {
  const side = serverSide();
  return [ev.name, ...(ev.also || [])].map(text).join(" · ") + (ev.side && !side ? ` (${ui()[ev.side]})` : "");
};
// The field bosses on the maps this player's side sees.
const fieldBosses = () => {
  const side = serverSide();
  return Object.entries(FIELD_BOSSES)
    .filter(([, b]) => !b.side || !side || b.side === side)
    .map(([id, b]) => ({ id, ...b }));
};
// A field boss's timer from the feed: { state, upSince, nextSpawn, reportedAt } (seconds), or null.
const fieldTimer = (id) => (feed && feed.server === serverId() ? feed.bosses?.[id] || null : null);

function renderStatic() {
  const words = ui();
  const a = aui();
  const labels = { events: words.events, bosses: words.bosses, alerts: a.alerts, settings: a.settings };
  for (const tab of els.tabs) tab.textContent = labels[tab.dataset.tab];
  els.regionLabel.textContent = words.region;
  els.zoneLabel.textContent = a.showIn;
  els.soundLabel.textContent = a.sound;
  els.test.textContent = a.play;
  els.repeatLabel.textContent = words.repeat;
  els.popLabel.textContent = a.pop;
  els.mute.textContent = words.mute;
  els.dismiss.title = words.dismiss;
  els.dismiss.setAttribute("aria-label", words.dismiss);
  els.scheduledHead.textContent = words.scheduled;
  els.fieldHead.textContent = words.field;
  els.zoneSelect.replaceChildren(option("system", a.systemTime(SYSTEM_ZONE || "?")), option("server", a.serverTime),
    ...ALL_ZONES.map((z) => option(z, z.replaceAll("_", " "))));
  els.zoneSelect.value = prefs.display;
  if (els.zoneSelect.value !== prefs.display) els.zoneSelect.value = "system";
  els.regionSelect.replaceChildren(option("auto", words.auto),
    ...Object.keys(REGIONS).map((k) => option(k, words.regions[k - 1])));
  els.regionSelect.value = String(prefs.region);
  els.sound.replaceChildren(...[...SOUND_ORDER, "off"].map((v) => option(v, v === "off" ? a.none : a.sounds[v])));
  els.sound.value = prefs.sound;
  els.repeat.replaceChildren(...REPEATS.map((n) => option(n, n === 0 ? words.untilMuted : n === 1 ? words.once : words.times(n))));
  els.repeat.value = String(prefs.repeat);
  els.pop.checked = !!prefs.pop;
  renderTabs();
  renderAlerts();
}

function renderTabs() {
  for (const tab of els.tabs) tab.setAttribute("aria-selected", String(tab.dataset.tab === prefs.tab));
  for (const [name, view] of Object.entries(els.views)) view.hidden = name !== prefs.tab;
}

// The header: server, region and its clock; the resets.
function renderHeader(now) {
  const words = ui();
  const tz = timeZone();
  if (!tz) {
    els.status.textContent = serverRegion() === 0 ? words.unsupported : words.pick;
  } else {
    const parts = [serverName(), words.regions[region() - 1], tz.split("/").pop().replace("_", " ")];
    els.status.textContent = parts.filter(Boolean).join(" · ");
  }
  const resets = EVENTS.filter((ev) => ev.kind === "reset").map((ev) => {
    const next = nextOf(ev, "UTC", now);
    return next ? `${text(ev.name)} ${words.in(span(next.start - now))}` : "";
  });
  els.resets.textContent = resets.filter(Boolean).join(" · ");
}

// One countdown row: name (and a bell when its alert is on), where, and when.
function row({ id, name, where, countdown, at, running, up, hide }) {
  const li = document.createElement("li");
  li.classList.toggle("running", !!running);
  li.classList.toggle("up", !!up);
  const n = document.createElement("span");
  n.className = "name";
  n.textContent = name;
  if (id in prefs.alerts || (id.startsWith("field:") && ALL_FIELD in prefs.alerts)) {
    const bell = document.createElement("span");
    bell.className = "bell";
    bell.textContent = "🔔";
    n.prepend(bell);
  }
  const w = document.createElement("span");
  w.className = "where";
  w.textContent = where;
  const when = document.createElement("span");
  when.className = "when";
  const c = document.createElement("div");
  c.className = "countdown";
  c.textContent = countdown;
  const t = document.createElement("div");
  t.className = "at";
  t.textContent = at;
  when.append(c, t);
  li.append(n, when);
  if (hide) li.append(hide);
  li.append(w);
  return li;
}

function renderSchedule(list, events, now, { hideable }) {
  const words = ui();
  const tz = timeZone();
  const fmt = clock();
  const shown = events.filter((ev) => tz || ev.utc).map((ev) => ({ ev, next: nextOf(ev, tz || "UTC", now) })).filter((x) => x.next);
  const visible = shown.filter((x) => !hideable || !prefs.hidden.includes(x.ev.id)).sort((a, b) => a.next.start - b.next.start);
  list.replaceChildren(...visible.map(({ ev, next }) => {
    const running = next.start <= now;
    let hide = null;
    if (hideable) {
      hide = document.createElement("button");
      hide.type = "button";
      hide.className = "hide";
      hide.textContent = "×";
      hide.title = words.hide;
      hide.addEventListener("click", () => {
        prefs.hidden = [...new Set([...prefs.hidden, ev.id])];
        savePrefs();
        render();
      });
    }
    return row({
      id: ev.id, name: eventName(ev), where: ev.where.map(text).join(", "), running, hide,
      countdown: running ? `${words.now} · ${words.left(span(next.end - now))}` : words.in(span(next.start - now)),
      at: fmt.format(new Date(next.start)),
    });
  }));
  return shown;
}

function renderHidden(shown) {
  const words = ui();
  const hiddenOnes = shown.filter((x) => prefs.hidden.includes(x.ev.id));
  els.hidden.replaceChildren();
  if (!hiddenOnes.length) return;
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

// Field bosses: up ones first, then by when they're back, then the ones no
// meter has reported yet.
function renderField(now) {
  const words = ui();
  const fmt = clock();
  if (typeof a2.bossTimers !== "function") els.fieldNote.textContent = words.noFeed;
  else if (!serverId()) els.fieldNote.textContent = words.noServer;
  else if (feed?.error) els.fieldNote.textContent = words.feedFailed;
  else els.fieldNote.textContent = words.fieldNote;
  const rows = fieldBosses().map((b) => {
    const t = fieldTimer(b.id);
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : null;
    const order = t?.state === "up" ? 0 : next ? 1 : 2;
    return { b, t, next, order };
  }).sort((x, y) => x.order - y.order || (x.next || 0) - (y.next || 0) || text(x.b.name).localeCompare(text(y.b.name)));
  els.field.replaceChildren(...rows.map(({ b, t, next }) => {
    let countdown = "–";
    let at = words.unknown;
    let up = false;
    if (t?.state === "up") {
      up = true;
      countdown = t.upSince ? `${words.up} · ${words.upFor(span(now - t.upSince * 1000))}` : words.up;
      at = words.seen(age(now - (t.reportedAt || 0) * 1000));
    } else if (next) {
      countdown = next > now ? words.in(span(next - now)) : words.due;
      at = fmt.format(new Date(next));
    }
    const name = text(b.name) + (b.level ? ` · Lv ${b.level}` : "");
    return row({ id: `field:${b.id}`, name, where: text(b.where), countdown, at, up });
  }));
}

function render() {
  const now = Date.now();
  renderHeader(now);
  renderHidden(renderSchedule(els.events, scheduled("event"), now, { hideable: true }));
  renderSchedule(els.scheduled, scheduled("boss"), now, { hideable: false });
  renderField(now);
}

// The alert list: every event, the scheduled bosses, all field bosses at once,
// then each field boss. A second lead, for while AION2 is closed, shows once
// the alert is on.
function renderAlerts() {
  const words = ui();
  const a = aui();
  const item = (id, label) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = label;
    const on = document.createElement("input");
    on.type = "checkbox";
    on.className = "alertOn";
    on.title = a.enable;
    on.checked = id in prefs.alerts;
    const lead = document.createElement("select");
    lead.className = "lead";
    lead.append(...LEADS.map((n) => option(n, n ? a.before(n) : a.atStart)));
    lead.value = String(prefs.alerts[id] ?? prefs.leads[id] ?? DEFAULT_LEAD);
    const closed = document.createElement("select");
    closed.className = "lead";
    closed.append(...[-1, ...LEADS].map((n) => option(n, n < 0 ? a.off : n ? a.before(n) : a.atStart)));
    closed.value = String(prefs.closedLeads[id] ?? DEFAULT_CLOSED_LEAD);
    const closedRow = document.createElement("label");
    closedRow.className = "closedRow";
    const closedLabel = document.createElement("span");
    closedLabel.textContent = a.closed;
    closedRow.append(closedLabel, closed);
    const show = () => {
      lead.hidden = !on.checked;
      closedRow.hidden = !on.checked;
    };
    show();
    const apply = () => {
      prefs.leads[id] = Number(lead.value);
      prefs.closedLeads[id] = Number(closed.value);
      if (on.checked) prefs.alerts[id] = Number(lead.value);
      else delete prefs.alerts[id];
      show();
      savePrefs();
      render();
    };
    on.addEventListener("change", apply);
    lead.addEventListener("change", apply);
    closed.addEventListener("change", apply);
    const pick = document.createElement("span");
    pick.className = "pick";
    pick.append(lead, on);
    li.append(name, pick, closedRow);
    return li;
  };
  const heading = (label) => {
    const li = document.createElement("li");
    li.className = "group";
    li.textContent = label;
    return li;
  };
  const field = fieldBosses().sort((x, y) => text(x.where).localeCompare(text(y.where)) || text(x.name).localeCompare(text(y.name)));
  els.alertList.replaceChildren(
    heading(words.events), ...scheduled("event").map((ev) => item(ev.id, eventName(ev))),
    heading(words.scheduled), ...scheduled("boss").map((ev) => item(ev.id, eventName(ev))),
    heading(words.field), item(ALL_FIELD, words.allField),
    ...field.map((b) => item(`field:${b.id}`, `${text(b.name)} · ${text(b.where)}`)),
  );
}

// The alert's banner, with the sound repeating until it has played as often
// as chosen or is muted.
let repeatTimer = 0;
let repeatUntil = 0;
const lines = [];
function stopSound() {
  clearTimeout(repeatTimer);
  repeatTimer = 0;
  els.mute.hidden = true;
}
function soundAlert() {
  stopSound();
  if (prefs.sound === "off") return;
  const times = Number(prefs.repeat);
  const gap = (soundLength(prefs.sound) + 0.7) * 1000;
  let left = times === 0 ? Infinity : Math.max(1, times);
  repeatUntil = Date.now() + UNTIL_MUTED_MS;
  const play = () => {
    playSound(prefs.sound);
    left -= 1;
    if (left > 0 && Date.now() < repeatUntil) repeatTimer = setTimeout(play, gap);
    else stopSound();
  };
  els.mute.hidden = left <= 1;
  play();
}
function alertBanner(message) {
  lines.push(message);
  while (lines.length > 3) lines.shift();
  els.bannerText.textContent = lines.join(" · ");
  els.banner.hidden = false;
  soundAlert();
  if (prefs.pop && a2.window && typeof a2.window.show === "function") a2.window.show().catch(() => {});
}
els.mute.addEventListener("click", stopSound);
els.dismiss.addEventListener("click", () => {
  stopSound();
  lines.length = 0;
  els.banner.hidden = true;
});

// Alerts: each goes off once, when its moment (the start less its lead)
// passes between one check and the next. Opening the window after the
// moment doesn't sound it late.
let lastCheck = Date.now();
const fired = new Set();
function checkAlerts(now) {
  const tz = timeZone();
  const a = aui();
  const words = ui();
  const closedNow = gameRunning === false;
  const minutesFor = (id) => {
    const m = closedNow ? Number(prefs.closedLeads[id] ?? DEFAULT_CLOSED_LEAD) : prefs.alerts[id];
    return m >= 0 ? m : null;
  };
  const due = (key, start, minutes) => {
    const at = start - minutes * 60_000;
    const k = `${closedNow ? "closed" : "open"}:${key}@${start}`;
    if (at > lastCheck && at <= now && !fired.has(k)) {
      fired.add(k);
      return true;
    }
    return false;
  };
  for (const ev of [...scheduled("event"), ...scheduled("boss")]) {
    if (!(ev.id in prefs.alerts) || (!tz && !ev.utc)) continue;
    const minutes = minutesFor(ev.id);
    if (minutes === null) continue;
    // The showing that is next once the lead is counted.
    const next = nextOf(ev, tz || "UTC", lastCheck + minutes * 60_000 - 1);
    if (next && due(ev.id, next.start, minutes)) {
      const name = text(ev.name);
      alertBanner(minutes ? a.soon(name, minutes) : a.now(name));
    }
  }
  for (const b of fieldBosses()) {
    const id = `field:${b.id}`;
    const own = id in prefs.alerts;
    if (!own && !(ALL_FIELD in prefs.alerts)) continue;
    const t = fieldTimer(b.id);
    if (t?.state !== "dead" || !t.nextSpawn) continue;
    const minutes = minutesFor(own ? id : ALL_FIELD);
    if (minutes === null) continue;
    if (due(id, t.nextSpawn * 1000, minutes)) {
      const name = text(b.name);
      alertBanner(minutes ? words.bossSoon(name, minutes) : words.bossNow(name));
    }
  }
  lastCheck = now;
}

// The field boss timers for the player's server: when the window opens, when
// the server changes, and every 15 minutes.
let feedTimer = 0;
async function readFeed() {
  clearTimeout(feedTimer);
  feedTimer = setTimeout(readFeed, FEED_EVERY_MS);
  const server = serverId();
  if (!server || typeof a2.bossTimers !== "function") return;
  try {
    const data = await a2.bossTimers(server);
    feed = { server, bosses: data?.bosses || {}, at: Date.now() };
  } catch {
    feed = { server, error: true };
  }
  render();
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
els.repeat.addEventListener("change", () => {
  prefs.repeat = Number(els.repeat.value);
  savePrefs();
});
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
  const before = serverId();
  character = c || null;
  const id = Number(character?.serverId);
  if (id >= 1000 && id !== Number(prefs.lastServer)) {
    prefs.lastServer = id;
    savePrefs();
  }
  renderAlerts();
  render();
  if (serverId() !== before) readFeed();
});
a2.on("language", (code) => {
  language = typeof code === "string" ? code : "en";
  renderStatic();
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
  // The old single "timers" tab is the events one now.
  if (!els.views[prefs.tab]) prefs.tab = "events";
  renderStatic();
  render();
  lastCheck = Date.now();
  setInterval(() => {
    const now = Date.now();
    checkAlerts(now);
    render();
  }, 1000);
  await a2.ready();
  readFeed();
})();
