// Anchor mode: the icons line up in a grid beside an anchor the player
// places, instead of each going where it was dragged. The grid grows from
// the anchor in the direction chosen (left and down unless changed), up to
// a number of icons across (Max width) and down (Max height); when more
// would show than fit, the last place shows "+N" and names the rest. Sort by
// says which come first.
//
// World Boss Train, in anchor mode: every world boss that is up, or spawns
// within 5 minutes, joins the grid, alert or not; a group going from boss to
// boss sees the next one coming. Among those up and not being fought, the
// rarest (longest to respawn) come first.
//
// Needs meter 2.0.72 or newer (a2.widgets.where and place). Loaded after
// pins.js: updatePins() asks anchorPlan() which icons to show, in what
// order, and anchorLayout() where to put them.

const ANCHOR_UI = {
  en: { anchor: "Anchor mode", anchorNote: "Icons line up beside an anchor (⚓) you place. Unlock the icons to move the anchor; locked, it's hidden.",
        expand: "Expand direction", dirs: { "left-down": "Left, then down", "right-down": "Right, then down", "left-up": "Left, then up", "right-up": "Right, then up" },
        maxWidth: "Max width (icons across)", maxHeight: "Max height (icons down)", sortBy: "Sort by",
        sorts: { urgent: "Most urgent first", rarest: "Rarest first", soonest: "Soonest first" },
        sortNotes: { urgent: "Being fought (lowest HP first), then up now (rarest first), then the soonest.", rarest: "Up now, the longest to respawn first, then the soonest.", soonest: "Up now, then in the order they start." },
        train: "World Boss Train", trainNote: "Every world boss that is up, or spawns within 5 minutes, joins the grid, with an alert or not.",
        needsMeter: "Anchor mode needs meter 2.0.72 or newer.", more: (n) => `${n} more` },
  ko: { anchor: "앵커 모드", anchorNote: "아이콘이 직접 놓은 앵커(⚓) 옆에 정렬됩니다. 앵커를 옮기려면 아이콘 잠금을 푸세요. 잠그면 앵커가 숨겨집니다.",
        expand: "확장 방향", dirs: { "left-down": "왼쪽, 그다음 아래", "right-down": "오른쪽, 그다음 아래", "left-up": "왼쪽, 그다음 위", "right-up": "오른쪽, 그다음 위" },
        maxWidth: "최대 너비 (가로 아이콘 수)", maxHeight: "최대 높이 (세로 아이콘 수)", sortBy: "정렬",
        sorts: { urgent: "급한 순", rarest: "희귀한 순", soonest: "빠른 순" },
        sortNotes: { urgent: "전투 중(HP 낮은 순), 출현 중(희귀한 순), 그다음 곧 출현할 순서입니다.", rarest: "출현 중인 보스를 재출현이 긴 순으로, 그다음 곧 출현할 순서입니다.", soonest: "출현 중, 그다음 시작하는 순서입니다." },
        train: "월드 보스 트레인", trainNote: "출현 중이거나 5분 안에 출현하는 월드 보스를 알림과 상관없이 모두 표시합니다.",
        needsMeter: "앵커 모드는 미터 2.0.72 이상이 필요합니다.", more: (n) => `${n}개 더` },
  ja: { anchor: "アンカーモード", anchorNote: "アイコンが、置いたアンカー（⚓）の横に並びます。アンカーを動かすにはアイコンのロックを外します。ロック中は隠れます。",
        expand: "広がる方向", dirs: { "left-down": "左、次に下", "right-down": "右、次に下", "left-up": "左、次に上", "right-up": "右、次に上" },
        maxWidth: "最大幅（横のアイコン数）", maxHeight: "最大高さ（縦のアイコン数）", sortBy: "並び順",
        sorts: { urgent: "急ぎの順", rarest: "レアな順", soonest: "早い順" },
        sortNotes: { urgent: "戦闘中（HPの低い順）、出現中（レアな順）、次に出現の早い順。", rarest: "出現中を再出現の長い順に、次に出現の早い順。", soonest: "出現中、次に始まる順。" },
        train: "ワールドボストレイン", trainNote: "出現中か5分以内に出現するワールドボスを、通知の有無にかかわらずすべて並べます。",
        needsMeter: "アンカーモードにはメーター2.0.72以降が必要です。", more: (n) => `ほか${n}件` },
  de: { anchor: "Ankermodus", anchorNote: "Die Symbole reihen sich neben einem Anker (⚓) auf, den du platzierst. Zum Verschieben des Ankers die Symbole entsperren; gesperrt ist er ausgeblendet.",
        expand: "Wachstumsrichtung", dirs: { "left-down": "Links, dann nach unten", "right-down": "Rechts, dann nach unten", "left-up": "Links, dann nach oben", "right-up": "Rechts, dann nach oben" },
        maxWidth: "Max. Breite (Symbole nebeneinander)", maxHeight: "Max. Höhe (Symbole untereinander)", sortBy: "Sortieren nach",
        sorts: { urgent: "Dringendste zuerst", rarest: "Seltenste zuerst", soonest: "Nächste zuerst" },
        sortNotes: { urgent: "Im Kampf (niedrigste HP zuerst), dann jetzt da (seltenste zuerst), dann die nächsten.", rarest: "Jetzt da, längste Respawnzeit zuerst, dann die nächsten.", soonest: "Jetzt da, dann in der Reihenfolge ihres Starts." },
        train: "Weltboss-Train", trainNote: "Jeder Weltboss, der da ist oder in 5 Minuten erscheint, kommt ins Raster, mit oder ohne Alarm.",
        needsMeter: "Der Ankermodus braucht Meter 2.0.72 oder neuer.", more: (n) => `${n} weitere` },
  fr: { anchor: "Mode ancre", anchorNote: "Les icônes s'alignent à côté d'une ancre (⚓) que vous placez. Déverrouillez les icônes pour déplacer l'ancre ; verrouillée, elle est masquée.",
        expand: "Sens d'extension", dirs: { "left-down": "Gauche, puis bas", "right-down": "Droite, puis bas", "left-up": "Gauche, puis haut", "right-up": "Droite, puis haut" },
        maxWidth: "Largeur max (icônes en ligne)", maxHeight: "Hauteur max (icônes en colonne)", sortBy: "Trier par",
        sorts: { urgent: "Les plus urgents d'abord", rarest: "Les plus rares d'abord", soonest: "Les plus proches d'abord" },
        sortNotes: { urgent: "Attaqués (PV les plus bas d'abord), puis présents (les plus rares d'abord), puis les plus proches.", rarest: "Présents, la plus longue réapparition d'abord, puis les plus proches.", soonest: "Présents, puis dans l'ordre où ils commencent." },
        train: "Train de boss mondiaux", trainNote: "Chaque boss mondial présent, ou qui apparaît dans 5 minutes, rejoint la grille, avec ou sans alerte.",
        needsMeter: "Le mode ancre nécessite le compteur 2.0.72 ou plus récent.", more: (n) => `${n} de plus` },
  es: { anchor: "Modo ancla", anchorNote: "Los iconos se alinean junto a un ancla (⚓) que colocas tú. Desbloquea los iconos para mover el ancla; bloqueada, se oculta.",
        expand: "Dirección de expansión", dirs: { "left-down": "Izquierda, luego abajo", "right-down": "Derecha, luego abajo", "left-up": "Izquierda, luego arriba", "right-up": "Derecha, luego arriba" },
        maxWidth: "Ancho máx. (iconos en fila)", maxHeight: "Alto máx. (iconos en columna)", sortBy: "Ordenar por",
        sorts: { urgent: "Más urgentes primero", rarest: "Más raros primero", soonest: "Más próximos primero" },
        sortNotes: { urgent: "En combate (menos PV primero), luego activos (más raros primero), luego los más próximos.", rarest: "Activos, el que más tarda en reaparecer primero, luego los más próximos.", soonest: "Activos, luego en el orden en que empiezan." },
        train: "Tren de jefes mundiales", trainNote: "Todo jefe mundial activo, o que aparezca en 5 minutos, se une a la cuadrícula, con alerta o sin ella.",
        needsMeter: "El modo ancla necesita el medidor 2.0.72 o posterior.", more: (n) => `${n} más` },
  pt: { anchor: "Modo âncora", anchorNote: "Os ícones se alinham ao lado de uma âncora (⚓) que você posiciona. Destrave os ícones para mover a âncora; travada, ela fica oculta.",
        expand: "Direção de expansão", dirs: { "left-down": "Esquerda, depois para baixo", "right-down": "Direita, depois para baixo", "left-up": "Esquerda, depois para cima", "right-up": "Direita, depois para cima" },
        maxWidth: "Largura máx. (ícones na linha)", maxHeight: "Altura máx. (ícones na coluna)", sortBy: "Ordenar por",
        sorts: { urgent: "Mais urgentes primeiro", rarest: "Mais raros primeiro", soonest: "Mais próximos primeiro" },
        sortNotes: { urgent: "Em combate (menos PV primeiro), depois ativos (mais raros primeiro), depois os mais próximos.", rarest: "Ativos, o que mais demora a renascer primeiro, depois os mais próximos.", soonest: "Ativos, depois na ordem em que começam." },
        train: "Trem de chefes mundiais", trainNote: "Todo chefe mundial ativo, ou que surja em 5 minutos, entra na grade, com alerta ou não.",
        needsMeter: "O modo âncora precisa do medidor 2.0.72 ou mais recente.", more: (n) => `mais ${n}` },
  ru: { anchor: "Режим якоря", anchorNote: "Значки выстраиваются рядом с якорем (⚓), который вы ставите сами. Чтобы двигать якорь, снимите фиксацию значков; при фиксации он скрыт.",
        expand: "Направление роста", dirs: { "left-down": "Влево, затем вниз", "right-down": "Вправо, затем вниз", "left-up": "Влево, затем вверх", "right-up": "Вправо, затем вверх" },
        maxWidth: "Макс. ширина (значков в ряд)", maxHeight: "Макс. высота (значков в столбец)", sortBy: "Сортировка",
        sorts: { urgent: "Сначала срочные", rarest: "Сначала редкие", soonest: "Сначала ближайшие" },
        sortNotes: { urgent: "В бою (меньше HP — раньше), затем появившиеся (сначала редкие), затем ближайшие.", rarest: "Появившиеся, с самым долгим возрождением первыми, затем ближайшие.", soonest: "Появившиеся, затем в порядке начала." },
        train: "Трейн мировых боссов", trainNote: "Каждый мировой босс, который на месте или появится в течение 5 минут, попадает в сетку, с оповещением или без.",
        needsMeter: "Для режима якоря нужен счётчик 2.0.72 или новее.", more: (n) => `ещё ${n}` },
  "zh-Hant": { anchor: "錨點模式", anchorNote: "圖示會排在你放置的錨點（⚓）旁。解除圖示鎖定即可移動錨點；鎖定時錨點會隱藏。",
        expand: "延伸方向", dirs: { "left-down": "向左，再向下", "right-down": "向右，再向下", "left-up": "向左，再向上", "right-up": "向右，再向上" },
        maxWidth: "最大寬度（橫向圖示數）", maxHeight: "最大高度（縱向圖示數）", sortBy: "排序",
        sorts: { urgent: "最緊急優先", rarest: "最稀有優先", soonest: "最快優先" },
        sortNotes: { urgent: "戰鬥中（HP 最低優先），再來是已出現（最稀有優先），然後是最快出現的。", rarest: "已出現的依重生最久優先，然後是最快出現的。", soonest: "已出現，然後依開始順序。" },
        train: "世界首領車隊", trainNote: "已出現或 5 分鐘內出現的世界首領都會加入網格，無論是否設定提醒。",
        needsMeter: "錨點模式需要計量器 2.0.72 以上。", more: (n) => `還有 ${n} 個` },
  "zh-Hans": { anchor: "锚点模式", anchorNote: "图标会排在你放置的锚点（⚓）旁。解除图标锁定即可移动锚点；锁定时锚点会隐藏。",
        expand: "延伸方向", dirs: { "left-down": "向左，再向下", "right-down": "向右，再向下", "left-up": "向左，再向上", "right-up": "向右，再向上" },
        maxWidth: "最大宽度（横向图标数）", maxHeight: "最大高度（纵向图标数）", sortBy: "排序",
        sorts: { urgent: "最紧急优先", rarest: "最稀有优先", soonest: "最快优先" },
        sortNotes: { urgent: "战斗中（HP 最低优先），再是已出现（最稀有优先），然后是最快出现的。", rarest: "已出现的按重生最久优先，然后是最快出现的。", soonest: "已出现，然后按开始顺序。" },
        train: "世界首领车队", trainNote: "已出现或 5 分钟内出现的世界首领都会加入网格，无论是否设置提醒。",
        needsMeter: "锚点模式需要计量器 2.0.72 以上。", more: (n) => `还有 ${n} 个` },
};
const anchorUi = () => ANCHOR_UI[language] || ANCHOR_UI.en;

// How long each world boss takes to respawn (minutes), by world-map id:
// measured on a2tools.app from 870 kills that a meter saw, each against the
// time a map then gave for its return (2026-10-16 to 10-18). Bosses not in
// it have no measured time yet and count as least rare.
const RESPAWN_MIN = {"111003":30,"101001":30,"101002":30,"111001":30,"111002":30,"101003":30,"101007":60,"111004":60,
  "101006":90,"111006":90,"111007":120,"111009":120,"101004":120,"101019":120,"111005":120,"101017":120,"101005":120,
  "111008":120,"101015":180,"111010":180,"111011":180,"101010":180,"101009":180,"101008":180,"111017":180,"111014":180,
  "101013":240,"111015":240,"101018":240,"111012":240,"111013":240,"101016":240,"101011":240,"111018":240,"101020":360,
  "101023":360,"101012":360,"111024":360,"111016":360,"111019":360,"101014":360,"111020":360,"101022":360,"111023":360,
  "2001":720,"111021":720,"101024":720,"111022":720,"101021":720};
const respawnOf = (id) => (id.startsWith("field:") ? RESPAWN_MIN[id.slice(6)] || 0 : 0);

const ANCHOR = "anchor";
const MORE = "more";
const ANCHOR_SIZE = { width: 32, height: 32 };
const DIRECTIONS = ["left-down", "right-down", "left-up", "right-up"];
const SORTS = ["urgent", "rarest", "soonest"];
const GRID_MAX = 8;
// The meter opens at most 16 widgets per plugin: the anchor, "+N" and the
// test icon take three.
const MOST_ICONS = 13;
const GAP_PX = 4;
// A world boss joins the train this long before it spawns.
const TRAIN_LEAD_MS = 5 * 60_000;

const canPlace = () => canPin() && typeof a2.widgets.place === "function" && typeof a2.widgets.where === "function";
const anchorOn = () => canPlace() && iconStyle() && !!prefs.anchorMode;
const trainOn = () => anchorOn() && !!prefs.anchorTrain;
const gridSize = (v, d) => Math.max(1, Math.min(GRID_MAX, Number(v) || d));

// The train's bosses, for iconPins(): each world boss without an alert of
// its own, shown while up or within TRAIN_LEAD_MS of spawning (pinVisible).
function trainPins(out, cfg) {
  if (!trainOn()) return;
  for (const b of fieldBosses()) {
    const id = `field:${b.id}`;
    // Not "Keep icons on screen", and no reminder: on the grid only while
    // up or about to spawn, and "Fighting" when it is.
    if (!(id in out)) out[id] = { ...cfg(id), always: false, lead: -1, fought: true, train: true };
  }
}
const trainVisible = (pin, state, until) =>
  !!pin.train && !state.killed && (state.running || (until != null && until <= TRAIN_LEAD_MS));

// Which comes first, for Sort by. `o` is each icon's { id, fight, running,
// hp, until, killed }.
function anchorCompare(a, b) {
  const sort = SORTS.includes(prefs.anchorSort) ? prefs.anchorSort : "urgent";
  const group = (o) => {
    if (o.killed) return 3;
    if (sort === "urgent" && o.fight) return 0;
    if (o.running) return 1;
    if (o.until != null) return 2;
    return 4;
  };
  const ga = group(a.order), gb = group(b.order);
  if (ga !== gb) return ga - gb;
  if (ga === 0) return (a.order.hp ?? 100) - (b.order.hp ?? 100);
  if (ga === 1 && sort !== "soonest") {
    const r = respawnOf(b.order.id) - respawnOf(a.order.id);
    if (r) return r;
  }
  if (ga === 1 || ga === 2) return (a.order.until ?? 0) - (b.order.until ?? 0);
  return 0;
}

// The icons to show, in grid order: `wanted` sorted, and those past the
// grid's room folded into "+N".
function anchorPlan(wanted) {
  if (!anchorOn()) return wanted;
  const entries = [...wanted.entries()].sort((a, b) => anchorCompare(a[1], b[1]));
  const room = Math.min(MOST_ICONS, gridSize(prefs.anchorCols, 4) * gridSize(prefs.anchorRows, 3));
  if (entries.length <= room) return new Map(entries);
  const shown = entries.slice(0, room - 1);
  const rest = entries.slice(room - 1);
  const names = rest.map(([, e]) => `${e.data.name} · ${e.data.countdown}`);
  const n = rest.length;
  shown.push([MORE, { id: MORE, order: {}, data: { name: anchorUi().more(n), glyph: `+${n}`, tip: names.join("\n"),
    showName: false, countdown: anchorUi().more(n), sub: "", hp: null, running: false, due: false, effect: "nothing", kind: "more", icon: "" } }]);
  return new Map(shown);
}

// Where each icon goes, beside the anchor. Asked of the meter in physical
// pixels; the icons' sizes are logical (pinSize), scaled by the anchor's.
const placed = new Map();
let anchorOpen = false;
let layoutBusy = false;
let layoutAgain = false;
let gridNames = [];

async function anchorLayout(names, showName) {
  gridNames = names;
  if (!anchorOn()) {
    if (anchorOpen) {
      anchorOpen = false;
      placed.clear();
      await a2.widgets.close(ANCHOR).catch(() => {});
    }
    return;
  }
  if (layoutBusy) {
    layoutAgain = true;
    return;
  }
  layoutBusy = true;
  try {
    if (!anchorOpen) {
      anchorOpen = await a2.widgets.open(ANCHOR, ANCHOR_SIZE).then(() => true, () => false);
      if (!anchorOpen) return;
    }
    a2.widgets.send(ANCHOR, { kind: "anchor", name: anchorUi().anchor }).catch(() => {});
    const at = await a2.widgets.where(ANCHOR).catch(() => null);
    if (!at) return;
    const scale = at.width / ANCHOR_SIZE.width || 1;
    const cols = gridSize(prefs.anchorCols, 4);
    const dir = DIRECTIONS.includes(prefs.anchorExpand) ? prefs.anchorExpand : "left-down";
    const left = dir.startsWith("left");
    const up = dir.endsWith("up");
    const sizes = names.map((name) => pinSize(name === MORE ? false : !!showName.get(name)));
    const cellW = Math.round((Math.max(...sizes.map((s) => s.width), 1) + GAP_PX) * scale);
    const cellH = Math.round((Math.max(...sizes.map((s) => s.height), 1) + GAP_PX) * scale);
    const gap = Math.round(GAP_PX * scale);
    for (const [i, name] of names.entries()) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const w = Math.round(sizes[i].width * scale);
      const h = Math.round(sizes[i].height * scale);
      const x = left ? at.x - gap - col * cellW - w : at.x + at.width + gap + col * cellW;
      const y = up ? at.y + at.height - row * cellH - h : at.y + row * cellH;
      const key = `${x},${y}`;
      if (placed.get(name) === key) continue;
      placed.set(name, key);
      await a2.widgets.place(name, { x, y }).catch(() => placed.delete(name));
    }
    for (const name of [...placed.keys()]) if (!names.includes(name)) placed.delete(name);
  } finally {
    layoutBusy = false;
    if (layoutAgain) {
      layoutAgain = false;
      anchorLayout(gridNames, lastShowName);
    }
  }
}
let lastShowName = new Map();
function anchorArrange(wanted) {
  lastShowName = new Map([...wanted].map(([name, e]) => [name, !!e.data.showName]));
  anchorLayout([...wanted.keys()], lastShowName);
}

// The anchor moved: the grid follows it. An icon dragged off its place goes
// back to it.
if (typeof a2.on === "function") {
  a2.on("widget-moved", (m) => {
    if (!anchorOn() || !m?.name) return;
    if (m.name === ANCHOR) placed.clear();
    else if (placed.get(m.name) === `${m.x},${m.y}`) return;
    else placed.delete(m.name);
    anchorLayout(gridNames, lastShowName);
  });
}

// Settings, under the icons' settings: anchor mode and its options.
function renderAnchorSettings(box) {
  const u = anchorUi();
  let rows = box.querySelector(".anchorSettings");
  if (!rows) {
    rows = document.createElement("div");
    rows.className = "anchorSettings";
    const row = (cls, control) => {
      const r = document.createElement("label");
      r.className = `setting ${cls}`;
      const s = document.createElement("span");
      s.className = "iconSettingLabel";
      r.append(s, control);
      return r;
    };
    const switchBox = (cls) => {
      const c = document.createElement("input");
      c.type = "checkbox";
      c.className = `${cls} switch`;
      c.setAttribute("role", "switch");
      return c;
    };
    const select = (cls) => {
      const s = document.createElement("select");
      s.className = cls;
      return s;
    };
    const note = (cls) => {
      const p = document.createElement("p");
      p.className = `note ${cls}`;
      return p;
    };
    rows.append(
      row("anchorRow", switchBox("anchorMode")), note("anchorNote"),
      row("expandRow", select("anchorExpand")),
      row("colsRow", select("anchorCols")),
      row("rowsRow", select("anchorRows")),
      row("sortRow", select("anchorSort")), note("sortNote"),
      row("trainRow", switchBox("anchorTrain")), note("trainNote"),
    );
    box.append(rows);
    const save = (apply) => (e) => {
      apply(e.target);
      savePrefs();
      placed.clear();
      renderAnchorSettings(box);
      updatePins(Date.now());
    };
    rows.querySelector(".anchorMode").addEventListener("change", save((t) => { prefs.anchorMode = t.checked; }));
    rows.querySelector(".anchorExpand").addEventListener("change", save((t) => { prefs.anchorExpand = t.value; }));
    rows.querySelector(".anchorCols").addEventListener("change", save((t) => { prefs.anchorCols = Number(t.value); }));
    rows.querySelector(".anchorRows").addEventListener("change", save((t) => { prefs.anchorRows = Number(t.value); }));
    rows.querySelector(".anchorSort").addEventListener("change", save((t) => { prefs.anchorSort = t.value; }));
    rows.querySelector(".anchorTrain").addEventListener("change", save((t) => { prefs.anchorTrain = t.checked; }));
  }
  const label = (cls, text) => { rows.querySelector(`.${cls} .iconSettingLabel`).textContent = text; };
  label("anchorRow", u.anchor);
  label("expandRow", u.expand);
  label("colsRow", u.maxWidth);
  label("rowsRow", u.maxHeight);
  label("sortRow", u.sortBy);
  label("trainRow", u.train);
  const mode = rows.querySelector(".anchorMode");
  mode.checked = !!prefs.anchorMode && canPlace();
  mode.disabled = !canPlace();
  rows.querySelector(".anchorNote").textContent = canPlace() ? u.anchorNote : u.needsMeter;
  const expand = rows.querySelector(".anchorExpand");
  expand.replaceChildren(...DIRECTIONS.map((d) => option(d, u.dirs[d])));
  expand.value = DIRECTIONS.includes(prefs.anchorExpand) ? prefs.anchorExpand : "left-down";
  const counts = Array.from({ length: GRID_MAX }, (_, i) => i + 1);
  const cols = rows.querySelector(".anchorCols");
  cols.replaceChildren(...counts.map((n) => option(n, String(n))));
  cols.value = String(gridSize(prefs.anchorCols, 4));
  const down = rows.querySelector(".anchorRows");
  down.replaceChildren(...counts.map((n) => option(n, String(n))));
  down.value = String(gridSize(prefs.anchorRows, 3));
  const sort = rows.querySelector(".anchorSort");
  sort.replaceChildren(...SORTS.map((s) => option(s, u.sorts[s])));
  sort.value = SORTS.includes(prefs.anchorSort) ? prefs.anchorSort : "urgent";
  rows.querySelector(".sortNote").textContent = u.sortNotes[sort.value];
  rows.querySelector(".anchorTrain").checked = !!prefs.anchorTrain;
  rows.querySelector(".trainNote").textContent = u.trainNote;
  rows.hidden = !iconStyle();
  const on = anchorOn();
  for (const cls of ["expandRow", "colsRow", "rowsRow", "sortRow", "sortNote", "trainRow", "trainNote"]) {
    rows.querySelector(`.${cls}`).hidden = !on;
  }
}
