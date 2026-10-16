// Alerts as icons (#12): each alert that is on shows as a small icon with its
// countdown, in a window of its own (a widget, meter 2.0.68 on) that the
// player drags anywhere and locks in place. The icon appears at the alert's
// time (or always, or some minutes before), shakes or glows when due, and the
// alert sounds; the plugin's window stays out of the way. Settings has the
// defaults (sound and repeat in plugin.js; when icons appear, their effect,
// their names, the lock); each alert can override any of them. "Show alerts
// as: This window" keeps the old way, a banner in this window.
//
// Loaded after plugin.js, whose timers it reads: plugin.js calls
// pinControls() for each alert row, updatePins() every second,
// pinnedIconOnly() before an alert brings up the window, and alertSound() for
// an alert's sound and repeats.

const PIN_UI = {
  en: { open: "Open", killed: "Killed", show: "Icon appears", always: "Always", before: (n) => `${n} min before`, withAlert: "At its alert time",
    name: "Name on the icon", effect: "Icon when due", shake: "Shake", glow: "Glow", nothing: "Nothing", style: "Show alerts as", icons: "Icons", window: "This window",
    custom: "Customise this alert", deflt: "Default", shown: "Shown", hiddenName: "Hidden", sound: "Sound", repeat: "Repeat",
    lock: "Lock the icons", lockNote: "Locked icons let clicks through to the game and can't be moved. Double-click an unlocked icon to open this window. Right-click an icon to stop its sound.",
    needsMeter: "Icons need meter 2.0.68 or newer", now: "Now" },
  ko: { open: "열림", killed: "처치", show: "아이콘 표시", always: "항상", before: (n) => `${n}분 전부터`, withAlert: "알림 시간에",
    name: "아이콘에 이름", effect: "시간이 되면 아이콘", shake: "흔들기", glow: "빛나기", nothing: "없음", style: "알림 표시 방식", icons: "아이콘", window: "이 창",
    custom: "이 알림 따로 설정", deflt: "기본값", shown: "표시", hiddenName: "숨김", sound: "소리", repeat: "반복",
    lock: "아이콘 잠금", lockNote: "잠긴 아이콘은 클릭이 게임으로 통과되고 움직일 수 없습니다. 잠기지 않은 아이콘을 더블클릭하면 이 창이 열립니다. 아이콘을 우클릭하면 소리가 멈춥니다.",
    needsMeter: "아이콘은 미터 2.0.68 이상이 필요합니다", now: "지금" },
  ja: { open: "開放中", killed: "討伐", show: "アイコンの表示", always: "常に", before: (n) => `${n}分前から`, withAlert: "通知のタイミングで",
    name: "アイコンに名前", effect: "時間になったらアイコンを", shake: "揺らす", glow: "光らせる", nothing: "なし", style: "通知の表示", icons: "アイコン", window: "このウィンドウ",
    custom: "この通知を個別に設定", deflt: "既定", shown: "表示", hiddenName: "非表示", sound: "サウンド", repeat: "繰り返し",
    lock: "アイコンをロック", lockNote: "ロックしたアイコンはクリックがゲームに通り、動かせません。ロックしていないアイコンをダブルクリックするとこのウィンドウが開きます。 アイコンを右クリックすると音が止まります。",
    needsMeter: "アイコンにはメーター2.0.68以降が必要です", now: "今" },
  de: { open: "Offen", killed: "Besiegt", show: "Symbol erscheint", always: "Immer", before: (n) => `${n} Min. vorher`, withAlert: "Zur Alarmzeit",
    name: "Name am Symbol", effect: "Symbol, wenn fällig", shake: "Wackeln", glow: "Leuchten", nothing: "Nichts", style: "Alarme zeigen als", icons: "Symbole", window: "Dieses Fenster",
    custom: "Diesen Alarm anpassen", deflt: "Standard", shown: "Angezeigt", hiddenName: "Ausgeblendet", sound: "Ton", repeat: "Wiederholen",
    lock: "Symbole sperren", lockNote: "Gesperrte Symbole lassen Klicks zum Spiel durch und lassen sich nicht verschieben. Ein Doppelklick auf ein nicht gesperrtes Symbol öffnet dieses Fenster. Ein Rechtsklick auf ein Symbol stoppt seinen Ton.",
    needsMeter: "Symbole brauchen Meter 2.0.68 oder neuer", now: "Jetzt" },
  fr: { open: "Ouvert", killed: "Vaincu", show: "L'icône apparaît", always: "Toujours", before: (n) => `${n} min avant`, withAlert: "À l'heure de l'alerte",
    name: "Nom sur l'icône", effect: "Icône à l'échéance", shake: "Secouer", glow: "Briller", nothing: "Rien", style: "Afficher les alertes en", icons: "Icônes", window: "Cette fenêtre",
    custom: "Personnaliser cette alerte", deflt: "Par défaut", shown: "Affiché", hiddenName: "Masqué", sound: "Son", repeat: "Répéter",
    lock: "Verrouiller les icônes", lockNote: "Les icônes verrouillées laissent passer les clics vers le jeu et ne bougent pas. Double-cliquez sur une icône non verrouillée pour ouvrir cette fenêtre. Un clic droit sur une icône arrête son son.",
    needsMeter: "Les icônes nécessitent le compteur 2.0.68 ou plus récent", now: "Maintenant" },
  es: { open: "Abierto", killed: "Derrotado", show: "El icono aparece", always: "Siempre", before: (n) => `${n} min antes`, withAlert: "A la hora de la alerta",
    name: "Nombre en el icono", effect: "Icono al llegar la hora", shake: "Agitar", glow: "Brillar", nothing: "Nada", style: "Mostrar las alertas como", icons: "Iconos", window: "Esta ventana",
    custom: "Personalizar esta alerta", deflt: "Predeterminado", shown: "Visible", hiddenName: "Oculto", sound: "Sonido", repeat: "Repetir",
    lock: "Bloquear los iconos", lockNote: "Los iconos bloqueados dejan pasar los clics al juego y no se pueden mover. Haz doble clic en un icono sin bloquear para abrir esta ventana. Haz clic derecho en un icono para detener su sonido.",
    needsMeter: "Los iconos necesitan el medidor 2.0.68 o posterior", now: "Ahora" },
  pt: { open: "Aberto", killed: "Derrotado", show: "O ícone aparece", always: "Sempre", before: (n) => `${n} min antes`, withAlert: "Na hora do alerta",
    name: "Nome no ícone", effect: "Ícone na hora", shake: "Tremer", glow: "Brilhar", nothing: "Nada", style: "Mostrar os alertas como", icons: "Ícones", window: "Esta janela",
    custom: "Personalizar este alerta", deflt: "Padrão", shown: "Visível", hiddenName: "Oculto", sound: "Som", repeat: "Repetir",
    lock: "Travar os ícones", lockNote: "Ícones travados deixam os cliques passarem para o jogo e não se movem. Clique duas vezes num ícone destravado para abrir esta janela. Clique com o botão direito num ícone para parar o som.",
    needsMeter: "Os ícones precisam do medidor 2.0.68 ou mais recente", now: "Agora" },
  ru: { open: "Открыт", killed: "Убит", show: "Значок появляется", always: "Всегда", before: (n) => `за ${n} мин`, withAlert: "Во время оповещения",
    name: "Название на значке", effect: "Значок, когда пора", shake: "Трясти", glow: "Светиться", nothing: "Ничего", style: "Показывать оповещения", icons: "Значками", window: "В этом окне",
    custom: "Настроить это оповещение", deflt: "По умолчанию", shown: "Показано", hiddenName: "Скрыто", sound: "Звук", repeat: "Повтор",
    lock: "Зафиксировать значки", lockNote: "Зафиксированные значки пропускают клики в игру и не двигаются. Двойной клик по незафиксированному значку открывает это окно. Правый клик по значку останавливает звук.",
    needsMeter: "Для значков нужен счётчик 2.0.68 или новее", now: "Сейчас" },
  "zh-Hant": { open: "開啟中", killed: "已擊殺", show: "圖示出現", always: "一律", before: (n) => `${n} 分鐘前`, withAlert: "在提醒時間",
    name: "圖示上的名稱", effect: "時間到時圖示", shake: "晃動", glow: "發光", nothing: "無", style: "提醒顯示為", icons: "圖示", window: "此視窗",
    custom: "個別設定此提醒", deflt: "預設", shown: "顯示", hiddenName: "隱藏", sound: "音效", repeat: "重複",
    lock: "鎖定圖示", lockNote: "鎖定的圖示會讓點擊穿透到遊戲，且無法移動。雙擊未鎖定的圖示可開啟此視窗。右鍵點擊圖示可停止音效。",
    needsMeter: "圖示需要計量器 2.0.68 以上", now: "現在" },
  "zh-Hans": { open: "开启中", killed: "已击杀", show: "图标出现", always: "始终", before: (n) => `${n} 分钟前`, withAlert: "在提醒时间",
    name: "图标上的名称", effect: "时间到时图标", shake: "晃动", glow: "发光", nothing: "无", style: "提醒显示为", icons: "图标", window: "此窗口",
    custom: "单独设置此提醒", deflt: "默认", shown: "显示", hiddenName: "隐藏", sound: "音效", repeat: "重复",
    lock: "锁定图标", lockNote: "锁定的图标会让点击穿透到游戏，且无法移动。双击未锁定的图标可打开此窗口。右键点击图标可停止音效。",
    needsMeter: "图标需要计量器 2.0.68 或更新版本", now: "现在" },
};
const pinUi = () => PIN_UI[language] || PIN_UI.en;
// When an icon appears: -2 = at its alert's time, -1 = always, else minutes
// before its timer.
const PIN_SHOW = [-2, -1, 5, 10, 15, 20, 30, 45, 60, 120];
const PIN_EFFECTS = ["shake", "glow", "nothing"];
// How long a pin counts as due after its timer starts, so the effect is seen.
const DUE_AFTER_MS = 60_000;
// A field boss seen up and then killed shows "Killed" this long, then goes
// (or, shown always, counts down to its respawn).
const KILLED_SHOW_MS = 20_000;
// Field bosses seen up, and when each was seen killed.
const seenUp = new Set();
const killedAt = new Map();
const canPin = () => !!(a2.widgets && typeof a2.widgets.open === "function");
// Icons are the alerts, unless the player chose the window (or the meter has
// no widgets).
const iconStyle = () => canPin() && prefs.alertStyle !== "window";
const overrides = () => (prefs.overrides ||= {});
// A widget's name: lowercase letters, digits and "-" ("field:101006" is
// "field-101006").
const widgetName = (id) => id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "timer";

// Pins made while icons were a separate option (0.4.0 test builds): each
// becomes an alert with its own icon settings.
function migratePins() {
  if (!prefs.pins) return;
  for (const [id, pin] of Object.entries(prefs.pins)) {
    if (!(id in prefs.alerts)) prefs.alerts[id] = prefs.leads[id] ?? defaultLead();
    const o = { ...(overrides()[id] || {}) };
    if (pin.show != null) o.show = Number(pin.show);
    if (pin.effect) o.effect = pin.effect;
    if (pin.name != null) o.name = !!pin.name;
    overrides()[id] = o;
  }
  delete prefs.pins;
  savePrefs();
}

// The icons to show and how: one per alert that is on, and with "All field
// bosses" on, one per field boss without an alert of its own. Each with the
// key its settings come from.
function iconPins() {
  if (!iconStyle()) return {};
  migratePins();
  const cfg = (key) => {
    const o = overrides()[key] || {};
    return {
      key,
      show: Number(o.show ?? prefs.iconShow ?? -2),
      effect: o.effect ?? prefs.iconEffect ?? "shake",
      name: o.name ?? prefs.iconName ?? true,
      lead: Number(prefs.alerts[key] ?? 0),
    };
  };
  const out = {};
  for (const id of Object.keys(prefs.alerts)) if (id !== ALL_FIELD) out[id] = cfg(id);
  if (ALL_FIELD in prefs.alerts) {
    for (const b of fieldBosses()) {
      const id = `field:${b.id}`;
      if (!(id in out)) out[id] = cfg(ALL_FIELD);
    }
  }
  return out;
}

// The game's own icon for a timer (icons/, from the game files): Shugo Festa,
// the Dimensional Invasion, the rift, Artifact War, and the boss marker for
// every boss. Anything else shows its initials.
const pinIcon = (id, kind) => {
  if (id.startsWith("field:") || kind === "boss") return "boss";
  if (id.startsWith("festival")) return "shugo";
  if (id.startsWith("invasion")) return "invasion";
  if (id === "rift") return "rift";
  if (id === "artifact") return "artifact";
  return "";
};
// An icon's window: room for its countdown, and its name, on two lines each.
const pinSize = (showName) => ({ width: 104, height: showName ? 134 : 104 });

// What a timer is doing now: its name, kind, the next start (ms) or null,
// whether it is running (an event under way, a field boss up), and a field
// boss's HP and kill.
function pinState(id, now) {
  if (id.startsWith("field:")) {
    const b = fieldBosses().find((x) => `field:${x.id}` === id);
    if (!b) return null;
    const t = fieldTimer(b.id);
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : null;
    // Its HP while it is up and the report is fresh (the feed drops it after
    // 30 minutes), for the ring around its icon.
    const hp = t?.state === "up" && t.hp != null && t.hpAt ? Math.max(0, Math.min(100, Number(t.hp))) : null;
    // Up, then dead: killed just now.
    if (t?.state === "up") {
      seenUp.add(id);
      killedAt.delete(id);
    } else if (t?.state === "dead" && seenUp.has(id)) {
      seenUp.delete(id);
      killedAt.set(id, now);
    }
    const killed = killedAt.has(id) && now - killedAt.get(id) < KILLED_SHOW_MS;
    return { name: text(b.name), kind: "field", start: next, running: t?.state === "up", end: null, hp, killed };
  }
  const ev = EVENTS.find((e) => e.id === id);
  if (!ev) return null;
  const tz = timeZone();
  if (!tz && !ev.utc) return { name: text(ev.name), kind: ev.kind === "boss" ? "boss" : "event", start: null, running: false, end: null };
  const next = nextOf(ev, tz || "UTC", now);
  return {
    name: text(ev.name),
    kind: ev.kind === "boss" ? "boss" : "event",
    start: next ? next.start : null,
    end: next ? next.end : null,
    running: !!next && next.start <= now,
    // Open to enter until `end` (nextOf counts only that while as running).
    entry: !!ev.enter,
  };
}

// "up" while a field boss with an icon is up, "soon" while one is due within
// 5 minutes or overdue, else "": how often plugin.js reads the feed, for its
// HP as it falls and its kill.
function pinnedBossLive(now) {
  let soon = false;
  for (const id of Object.keys(iconPins())) {
    if (!id.startsWith("field:")) continue;
    const t = fieldTimer(id.slice(6));
    if (t?.state === "up" || seenUp.has(id)) return "up";
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : 0;
    if (next > 0 && next - now <= 5 * 60_000 && now - next <= WINDOW_MS) soon = true;
  }
  return soon ? "soon" : "";
}

// Whether an alert comes as its icon (and sound) rather than this window.
function pinnedIconOnly() {
  return iconStyle();
}

// The sound and repeats for an alert: its own, else the defaults.
function alertSound(key) {
  const o = (key && overrides()[key]) || {};
  return { sound: o.sound ?? prefs.sound, repeat: Number(o.repeat ?? prefs.repeat) };
}

// "Customise this alert", under an alert that is on: its sound, repeats and
// icon, each "Default" (Settings) unless changed.
function pinControls(id) {
  const p = pinUi();
  const a = aui();
  const words = ui();
  const box = document.createElement("div");
  box.className = "pinBox";
  const head = document.createElement("label");
  head.className = "pinCheck";
  const on = document.createElement("input");
  on.type = "checkbox";
  on.checked = !!overrides()[id];
  const span = document.createElement("span");
  span.textContent = p.custom;
  head.append(on, span);
  const opts = document.createElement("div");
  opts.className = "pinOpts";
  const select = (values) => {
    const s = document.createElement("select");
    s.append(...values.map(([v, l]) => option(v, l)));
    return s;
  };
  const sound = select([["", p.deflt], ...[...SOUND_ORDER, "off"].map((v) => [v, v === "off" ? a.none : a.sounds[v]])]);
  const repeat = select([["", p.deflt], ...REPEATS.map((n) => [n, n === 0 ? words.untilMuted : n === 1 ? words.once : words.times(n)])]);
  const show = select([["", p.deflt], ...PIN_SHOW.map((n) => [n, n === -2 ? p.withAlert : n === -1 ? p.always : p.before(n)])]);
  const effect = select([["", p.deflt], ...PIN_EFFECTS.map((e) => [e, p[e]])]);
  const name = select([["", p.deflt], ["on", p.shown], ["off", p.hiddenName]]);
  const line = (label, control, icon) => {
    const row = document.createElement("label");
    row.className = "leadRow";
    if (icon) row.classList.add("iconOnlyRow");
    const s = document.createElement("span");
    s.textContent = label;
    row.append(s, control);
    return row;
  };
  opts.append(line(p.sound, sound), line(p.repeat, repeat), line(p.show, show, true), line(p.effect, effect, true), line(p.name, name, true));
  const fill = () => {
    const o = overrides()[id] || {};
    sound.value = o.sound ?? "";
    repeat.value = o.repeat != null ? String(o.repeat) : "";
    show.value = o.show != null ? String(o.show) : "";
    effect.value = o.effect ?? "";
    name.value = o.name == null ? "" : o.name ? "on" : "off";
    opts.hidden = !on.checked;
    for (const row of opts.querySelectorAll(".iconOnlyRow")) row.hidden = !iconStyle();
  };
  fill();
  const save = () => {
    if (!on.checked) {
      delete overrides()[id];
    } else {
      const o = {};
      if (sound.value) o.sound = sound.value;
      if (repeat.value !== "") o.repeat = Number(repeat.value);
      if (show.value !== "") o.show = Number(show.value);
      if (effect.value) o.effect = effect.value;
      if (name.value) o.name = name.value === "on";
      overrides()[id] = o;
    }
    fill();
    savePrefs();
    updatePins(Date.now());
  };
  for (const control of [on, sound, repeat, show, effect, name]) control.addEventListener("change", save);
  sound.addEventListener("change", () => {
    if (sound.value && sound.value !== "off") playSound(sound.value);
  });
  box.append(head, opts);
  return box;
}

// The open widgets, by widget name: the timer each shows and its height.
const openPins = new Map();
let pinsBusy = false;

// Every second: open the icons that should show, close the rest, and send
// each its countdown.
async function updatePins(now) {
  if (!canPin() || pinsBusy) return;
  // A field boss just started to matter: read the feed now, not at its next
  // scheduled read.
  const live = pinnedBossLive(now);
  const every = live === "up" ? FEED_PINNED_UP_MS : FEED_PINNED_MS;
  if (live && typeof readFeed === "function" && (!feed || !feed.at || now - feed.at >= every)) readFeed();
  pinsBusy = true;
  try {
    const p = pinUi();
    const words = ui();
    const wanted = new Map();
    for (const [id, pin] of Object.entries(iconPins())) {
      const state = pinState(id, now);
      if (!state) continue;
      const until = state.start != null ? state.start - now : null;
      // At its alert's time by default: as many minutes before as the alert.
      const showFrom = pin.show === -2 ? pin.lead : pin.show;
      const visible = pin.show === -1 || state.running || state.killed
        || (until != null && until <= Math.max(0, showFrom) * 60_000 + 1000);
      if (!visible) continue;
      // Due: from its alert's time (or the last minute), and for a minute
      // after it starts; an event that can be entered, while it can be.
      const due = (until != null && until <= Math.max(1, pin.lead) * 60_000 && until > -DUE_AFTER_MS)
        || (state.running && (state.entry || (state.start != null && now - state.start < DUE_AFTER_MS)));
      // An event that lasts a while (the rift's 10 minutes, an entrance's 3):
      // the time it has left, and under it "Enter" or "Open".
      const lasts = state.running && state.end != null && state.end > now && state.kind !== "field";
      const countdown = state.killed ? p.killed
        : state.running
          ? (lasts ? span(state.end - now) : state.kind === "field" ? words.up : p.now)
          : until != null ? span(until) : "–";
      const sub = state.killed ? "" : state.running && state.entry ? enterWord() : lasts ? p.open
        : state.hp != null ? `${Math.round(state.hp)}%` : "";
      wanted.set(widgetName(id), {
        id,
        data: { name: state.name, showName: !!pin.name, countdown, sub, hp: state.killed ? 0 : state.hp ?? null,
          running: state.running, due: due && !state.killed, effect: pin.effect, kind: state.kind, icon: pinIcon(id, state.kind) },
      });
    }
    for (const name of [...openPins.keys()]) {
      if (!wanted.has(name)) {
        openPins.delete(name);
        await a2.widgets.close(name).catch(() => {});
      }
    }
    for (const [name, { id, data }] of wanted) {
      // Opened, or opened again at its new size (its name turned on or off).
      const size = pinSize(data.showName);
      if (openPins.get(name)?.height !== size.height) {
        const ok = await a2.widgets.open(name, size).then(() => true, () => false);
        if (!ok) continue;
        openPins.set(name, { id, height: size.height });
      }
      a2.widgets.send(name, data).catch(() => {});
    }
  } finally {
    pinsBusy = false;
  }
}

// A double-click on an unlocked icon opens this window.
a2.on("widget-message", (msg) => {
  // A right-click on an icon: its sound stops.
  if (msg?.data?.mute) {
    stopSound();
    stopSounds();
    return;
  }
  if (msg?.data?.open && typeof windowApi === "function" && windowApi()) {
    showFull();
    windowApi().show().catch(() => {});
  }
});

// Settings: how alerts show, the icons' defaults, and the lock.
function renderPinLock() {
  const view = document.querySelector(".view.settings");
  if (!view) return;
  const p = pinUi();
  let box = view.querySelector(".iconSettings");
  if (!box) {
    box = document.createElement("div");
    box.className = "iconSettings";
    const row = (cls, control) => {
      const r = document.createElement("label");
      r.className = `setting ${cls}`;
      const s = document.createElement("span");
      s.className = "iconSettingLabel";
      r.append(s, control);
      return r;
    };
    const style = document.createElement("select");
    style.className = "alertStyle";
    const show = document.createElement("select");
    show.className = "iconShow";
    const effect = document.createElement("select");
    effect.className = "iconEffect";
    const name = document.createElement("input");
    name.type = "checkbox";
    name.className = "iconName switch";
    name.setAttribute("role", "switch");
    const lock = document.createElement("input");
    lock.type = "checkbox";
    lock.className = "pinLock switch";
    lock.setAttribute("role", "switch");
    const note = document.createElement("p");
    note.className = "note pinLockNote";
    box.append(row("styleRow", style), row("showRow", show), row("effectRow", effect), row("nameRow", name), row("lockRow", lock), note);
    const target = view.querySelector(".alertSettings") || view;
    target.prepend(box);
    style.addEventListener("change", () => {
      prefs.alertStyle = style.value;
      savePrefs();
      renderStatic();
      updatePins(Date.now());
    });
    show.addEventListener("change", () => {
      prefs.iconShow = Number(show.value);
      savePrefs();
      updatePins(Date.now());
    });
    effect.addEventListener("change", () => {
      prefs.iconEffect = effect.value;
      savePrefs();
      updatePins(Date.now());
    });
    name.addEventListener("change", () => {
      prefs.iconName = name.checked;
      savePrefs();
      updatePins(Date.now());
    });
    lock.addEventListener("change", () => {
      a2.widgets.lock(lock.checked).catch(() => {});
    });
    if (canPin()) a2.widgets.locked().then((locked) => { lock.checked = !!locked; }).catch(() => {});
  }
  const label = (cls, text) => { box.querySelector(`.${cls} .iconSettingLabel`).textContent = text; };
  label("styleRow", p.style);
  label("showRow", p.show);
  label("effectRow", p.effect);
  label("nameRow", p.name);
  label("lockRow", p.lock);
  const style = box.querySelector(".alertStyle");
  style.replaceChildren(option("icons", p.icons), option("window", p.window));
  style.value = iconStyle() ? "icons" : "window";
  style.disabled = !canPin();
  const show = box.querySelector(".iconShow");
  show.replaceChildren(...PIN_SHOW.map((n) => option(n, n === -2 ? p.withAlert : n === -1 ? p.always : p.before(n))));
  show.value = String(prefs.iconShow ?? -2);
  const effect = box.querySelector(".iconEffect");
  effect.replaceChildren(...PIN_EFFECTS.map((e) => option(e, p[e])));
  effect.value = prefs.iconEffect ?? "shake";
  box.querySelector(".iconName").checked = prefs.iconName ?? true;
  for (const cls of ["showRow", "effectRow", "nameRow", "lockRow"]) box.querySelector(`.${cls}`).hidden = !iconStyle();
  box.querySelector(".pinLockNote").textContent = canPin() ? p.lockNote : p.needsMeter;
  box.querySelector(".pinLockNote").hidden = canPin() && !iconStyle();
}
