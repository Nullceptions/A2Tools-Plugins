// Pinned countdowns (#12): any timer can be pinned as a small icon with its
// countdown, in a window of its own (a widget, meter 2.0.68 on) that the
// player drags anywhere and locks in place. Each pin can show from some
// minutes before its timer (or always), with or without its name, and shake
// or glow when it is due; its alert can then come with the icon alone,
// leaving the plugin's window closed.
//
// Loaded after plugin.js, whose timers it reads: plugin.js calls
// pinControls() for each row of the Alerts tab, updatePins() every second,
// and pinnedIconOnly() before an alert brings up the window.

const PIN_UI = {
  en: { pin: "Pin as icon", show: "Show", always: "Always", before: (n) => `${n} min before`, name: "Show name",
    effect: "When due", shake: "Shake", glow: "Glow", nothing: "Nothing", iconOnly: "Alert with the icon, not the window",
    lock: "Lock pinned icons", lockNote: "Locked icons let clicks through to the game and can't be moved. Double-click an unlocked icon to open this window.",
    needsMeter: "Pinned icons need meter 2.0.68 or newer", now: "Now" },
  ko: { pin: "아이콘으로 고정", show: "표시", always: "항상", before: (n) => `${n}분 전부터`, name: "이름 표시",
    effect: "시간이 되면", shake: "흔들기", glow: "빛나기", nothing: "없음", iconOnly: "창 대신 아이콘으로 알림",
    lock: "고정된 아이콘 잠금", lockNote: "잠긴 아이콘은 클릭이 게임으로 통과되고 움직일 수 없습니다. 잠기지 않은 아이콘을 더블클릭하면 이 창이 열립니다.",
    needsMeter: "아이콘 고정은 미터 2.0.68 이상이 필요합니다", now: "지금" },
  ja: { pin: "アイコンで固定", show: "表示", always: "常に", before: (n) => `${n}分前から`, name: "名前を表示",
    effect: "時間になったら", shake: "揺らす", glow: "光らせる", nothing: "なし", iconOnly: "ウィンドウではなくアイコンで通知",
    lock: "固定アイコンをロック", lockNote: "ロックしたアイコンはクリックがゲームに通り、動かせません。ロックしていないアイコンをダブルクリックするとこのウィンドウが開きます。",
    needsMeter: "アイコンの固定にはメーター2.0.68以降が必要です", now: "今" },
  de: { pin: "Als Symbol anheften", show: "Anzeigen", always: "Immer", before: (n) => `${n} Min. vorher`, name: "Name anzeigen",
    effect: "Wenn fällig", shake: "Wackeln", glow: "Leuchten", nothing: "Nichts", iconOnly: "Mit dem Symbol statt dem Fenster alarmieren",
    lock: "Angeheftete Symbole sperren", lockNote: "Gesperrte Symbole lassen Klicks zum Spiel durch und lassen sich nicht verschieben. Ein Doppelklick auf ein nicht gesperrtes Symbol öffnet dieses Fenster.",
    needsMeter: "Angeheftete Symbole brauchen Meter 2.0.68 oder neuer", now: "Jetzt" },
  fr: { pin: "Épingler en icône", show: "Afficher", always: "Toujours", before: (n) => `${n} min avant`, name: "Afficher le nom",
    effect: "À l'échéance", shake: "Secouer", glow: "Briller", nothing: "Rien", iconOnly: "Alerter avec l'icône, pas la fenêtre",
    lock: "Verrouiller les icônes épinglées", lockNote: "Les icônes verrouillées laissent passer les clics vers le jeu et ne bougent pas. Double-cliquez sur une icône non verrouillée pour ouvrir cette fenêtre.",
    needsMeter: "Les icônes épinglées nécessitent le compteur 2.0.68 ou plus récent", now: "Maintenant" },
  es: { pin: "Fijar como icono", show: "Mostrar", always: "Siempre", before: (n) => `${n} min antes`, name: "Mostrar nombre",
    effect: "Al llegar la hora", shake: "Agitar", glow: "Brillar", nothing: "Nada", iconOnly: "Avisar con el icono, no con la ventana",
    lock: "Bloquear iconos fijados", lockNote: "Los iconos bloqueados dejan pasar los clics al juego y no se pueden mover. Haz doble clic en un icono sin bloquear para abrir esta ventana.",
    needsMeter: "Los iconos fijados necesitan el medidor 2.0.68 o posterior", now: "Ahora" },
  pt: { pin: "Fixar como ícone", show: "Mostrar", always: "Sempre", before: (n) => `${n} min antes`, name: "Mostrar nome",
    effect: "Na hora", shake: "Tremer", glow: "Brilhar", nothing: "Nada", iconOnly: "Alertar com o ícone, não com a janela",
    lock: "Travar ícones fixados", lockNote: "Ícones travados deixam os cliques passarem para o jogo e não se movem. Clique duas vezes num ícone destravado para abrir esta janela.",
    needsMeter: "Ícones fixados precisam do medidor 2.0.68 ou mais recente", now: "Agora" },
  ru: { pin: "Закрепить значком", show: "Показывать", always: "Всегда", before: (n) => `за ${n} мин`, name: "Показывать название",
    effect: "Когда пора", shake: "Трясти", glow: "Светиться", nothing: "Ничего", iconOnly: "Оповещать значком, а не окном",
    lock: "Зафиксировать значки", lockNote: "Зафиксированные значки пропускают клики в игру и не двигаются. Двойной клик по незафиксированному значку открывает это окно.",
    needsMeter: "Для значков нужен счётчик 2.0.68 или новее", now: "Сейчас" },
  "zh-Hant": { pin: "釘選為圖示", show: "顯示", always: "一律", before: (n) => `${n} 分鐘前`, name: "顯示名稱",
    effect: "時間到時", shake: "晃動", glow: "發光", nothing: "無", iconOnly: "以圖示提醒，不開視窗",
    lock: "鎖定釘選圖示", lockNote: "鎖定的圖示會讓點擊穿透到遊戲，且無法移動。雙擊未鎖定的圖示可開啟此視窗。",
    needsMeter: "釘選圖示需要計量器 2.0.68 以上", now: "現在" },
  "zh-Hans": { pin: "固定为图标", show: "显示", always: "始终", before: (n) => `${n} 分钟前`, name: "显示名称",
    effect: "时间到时", shake: "晃动", glow: "发光", nothing: "无", iconOnly: "用图标提醒，不打开窗口",
    lock: "锁定固定的图标", lockNote: "锁定的图标会让点击穿透到游戏，且无法移动。双击未锁定的图标可打开此窗口。",
    needsMeter: "固定图标需要计量器 2.0.68 或更新版本", now: "现在" },
};
const pinUi = () => PIN_UI[language] || PIN_UI.en;
// Minutes before its timer a pin shows; -1 = always.
const PIN_SHOW = [-1, 5, 10, 15, 20, 30, 45, 60, 120];
const PIN_EFFECTS = ["shake", "glow", "nothing"];
// How long a pin counts as due after its timer starts, so the effect is seen.
const DUE_AFTER_MS = 60_000;
const canPin = () => !!(a2.widgets && typeof a2.widgets.open === "function");
const pins = () => (prefs.pins ||= {});
const pinOf = (id) => pins()[id] || null;
// A widget's name: lowercase letters, digits and "-" ("field:101006" is
// "field-101006").
const widgetName = (id) => id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "timer";

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
// A pin's window: room for its countdown, and its name, on two lines each.
const pinSize = (showName) => ({ width: 104, height: showName ? 134 : 104 });

// What a pinned timer is doing now: its name, kind, the next start (ms) or
// null, and whether it is running (an event under way, a field boss up).
function pinState(id, now) {
  if (id.startsWith("field:")) {
    const b = fieldBosses().find((x) => `field:${x.id}` === id);
    if (!b) return null;
    const t = fieldTimer(b.id);
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : null;
    return { name: text(b.name), kind: "field", start: next, running: t?.state === "up", end: null };
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

// Whether an alert for `id` should come with its icon alone.
function pinnedIconOnly(id) {
  return canPin() && !!pinOf(id)?.iconOnly;
}

// The pin settings under an Alerts row.
function pinControls(id) {
  const p = pinUi();
  const box = document.createElement("div");
  box.className = "pinBox";
  const head = document.createElement("label");
  head.className = "pinHead";
  const on = document.createElement("input");
  on.type = "checkbox";
  on.className = "pinOn";
  on.checked = !!pinOf(id);
  on.disabled = !canPin();
  const span = document.createElement("span");
  span.textContent = p.pin;
  head.append(on, span);
  if (!canPin()) head.title = p.needsMeter;
  const opts = document.createElement("div");
  opts.className = "pinOpts";
  const current = () => ({ show: -1, name: true, effect: "shake", iconOnly: false, ...(pinOf(id) || {}) });
  const show = document.createElement("select");
  show.append(...PIN_SHOW.map((n) => option(n, n < 0 ? p.always : p.before(n))));
  const effect = document.createElement("select");
  effect.append(...PIN_EFFECTS.map((e) => option(e, p[e])));
  const name = document.createElement("input");
  name.type = "checkbox";
  const iconOnly = document.createElement("input");
  iconOnly.type = "checkbox";
  const line = (label, control) => {
    const row = document.createElement("label");
    row.className = "leadRow";
    const s = document.createElement("span");
    s.textContent = label;
    row.append(s, control);
    return row;
  };
  const check = (label, control) => {
    const row = document.createElement("label");
    row.className = "pinCheck";
    const s = document.createElement("span");
    s.textContent = label;
    row.append(control, s);
    return row;
  };
  opts.append(line(p.show, show), line(p.effect, effect), check(p.name, name), check(p.iconOnly, iconOnly));
  const fill = () => {
    const c = current();
    show.value = String(c.show);
    effect.value = c.effect;
    name.checked = !!c.name;
    iconOnly.checked = !!c.iconOnly;
    opts.hidden = !on.checked;
  };
  fill();
  const save = () => {
    if (on.checked) {
      pins()[id] = { show: Number(show.value), name: name.checked, effect: effect.value, iconOnly: iconOnly.checked };
    } else {
      delete pins()[id];
    }
    fill();
    savePrefs();
    updatePins(Date.now());
  };
  for (const control of [on, show, effect, name, iconOnly]) control.addEventListener("change", save);
  box.append(head, opts);
  return box;
}

// The open widgets, by widget name: the timer id each shows.
const openPins = new Map();
let pinsBusy = false;

// Every second: open the pins that should show, close the rest, and send each
// its countdown.
async function updatePins(now) {
  if (!canPin() || pinsBusy) return;
  pinsBusy = true;
  try {
    const p = pinUi();
    const words = ui();
    const wanted = new Map();
    for (const [id, pin] of Object.entries(pins())) {
      const state = pinState(id, now);
      if (!state) continue;
      const lead = Number(pin.show);
      const until = state.start != null ? state.start - now : null;
      const visible = lead < 0 || state.running || (until != null && until <= lead * 60_000);
      if (!visible) continue;
      // Due: within its alert's lead (or the last minute), and for a minute
      // after it starts.
      const alertLead = id in prefs.alerts ? prefs.alerts[id] : 1;
      // An event that can be entered stays due for as long as it can be.
      const due = (until != null && until <= Math.max(1, alertLead) * 60_000 && until > -DUE_AFTER_MS)
        || (state.running && (state.entry || (state.start != null && now - state.start < DUE_AFTER_MS)));
      // While it can be entered: the time left to enter, and "Enter" under
      // it, as the game's own icon shows.
      const countdown = state.running
        ? (state.entry && state.end != null ? span(state.end - now) : state.kind === "field" ? words.up : p.now)
        : until != null ? span(until) : "–";
      const sub = state.running && state.entry ? enterWord() : "";
      wanted.set(widgetName(id), {
        id,
        data: { name: state.name, showName: !!pin.name, countdown, sub, running: state.running, due, effect: pin.effect, kind: state.kind,
          icon: pinIcon(id, state.kind) },
      });
    }
    for (const [name, open] of openPins) {
      if (!wanted.has(name)) {
        openPins.delete(name);
        await a2.widgets.close(name).catch(() => {});
      }
      void open;
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
  if (msg?.data?.open && typeof windowApi === "function" && windowApi()) {
    showFull();
    windowApi().show().catch(() => {});
  }
});

// The lock, in Settings.
function renderPinLock() {
  const view = document.querySelector(".view.settings");
  if (!view) return;
  let row = view.querySelector(".pinLockRow");
  const p = pinUi();
  if (!row) {
    row = document.createElement("label");
    row.className = "setting pinLockRow";
    const label = document.createElement("span");
    label.className = "pinLockLabel";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "pinLock switch";
    box.setAttribute("role", "switch");
    row.append(label, box);
    const note = document.createElement("p");
    note.className = "note pinLockNote";
    view.prepend(row, note);
    box.addEventListener("change", () => {
      a2.widgets.lock(box.checked).catch(() => {});
    });
    if (canPin()) a2.widgets.locked().then((locked) => { box.checked = !!locked; }).catch(() => {});
  }
  row.querySelector(".pinLockLabel").textContent = p.lock;
  view.querySelector(".pinLockNote").textContent = canPin() ? p.lockNote : p.needsMeter;
  row.querySelector(".pinLock").disabled = !canPin();
}
