// A bar of icons: what the plugin's page sends it ({ look, slots }), timed
// here against the clock, dragged unless locked; a double-click opens the
// settings.
const grid = document.querySelector(".grid");
let locked = false;
let look = { size: 42, direction: "right", opacity: 1, numbers: true, readyGlow: true };
let slots = [];
const nodes = new Map(); // key -> { el, slot, wasCooling }

const fmt = (ms) => {
  const s = ms / 1000;
  if (s >= 60) return `${Math.ceil(s / 60)}m`;
  if (s >= 10) return String(Math.ceil(s));
  return s.toFixed(1);
};

function build() {
  document.documentElement.style.setProperty("--s", `${look.size}px`);
  document.documentElement.style.setProperty("--gap", `${Math.round(look.size * 0.08) + 2}px`);
  grid.className = `grid ${look.direction}`;
  document.body.classList.toggle("noNumbers", !look.numbers);
  grid.style.opacity = String(look.opacity ?? 1);
  const keep = new Set(slots.map((s) => s.key));
  for (const [key, n] of nodes) {
    if (!keep.has(key)) {
      n.el.remove();
      nodes.delete(key);
    }
  }
  for (const s of slots) {
    let n = nodes.get(s.key);
    if (!n) {
      const el = document.createElement("div");
      el.className = "slot";
      for (const c of ["sweep", "bar", "num cdNum", "num buffNum"]) {
        const part = document.createElement(c.startsWith("num") ? "span" : "div");
        part.className = c;
        el.append(part);
      }
      n = { el, wasCooling: false };
      nodes.set(s.key, n);
    }
    n.slot = s;
    n.el.style.backgroundImage = s.icon ? `url("icons/${s.icon}.webp")` : "";
    grid.append(n.el);
  }
  tick();
}

function tick() {
  const now = Date.now();
  for (const n of nodes.values()) {
    const s = n.slot;
    const el = n.el;
    const cooling = s.cdEnd > now;
    const buffing = s.buffEnd > now;
    el.classList.toggle("cooling", cooling);
    el.classList.toggle("buffing", buffing);
    el.classList.toggle("both", cooling && buffing);
    const active = cooling || buffing || s.always;
    el.hidden = !active && locked;
    el.classList.toggle("idle", !active);
    const cdNum = el.querySelector(".cdNum");
    if (cooling) {
      const total = Math.max(1, s.cdEnd - s.cdStart);
      el.style.setProperty("--p", `${Math.min(360, ((s.cdEnd - now) / total) * 360)}deg`);
      cdNum.textContent = fmt(s.cdEnd - now);
    } else {
      cdNum.textContent = "";
    }
    if (buffing) {
      const total = Math.max(1, s.buffEnd - s.buffStart);
      el.style.setProperty("--w", `${Math.min(100, ((s.buffEnd - now) / total) * 100)}%`);
      el.querySelector(".buffNum").textContent = fmt(s.buffEnd - now);
    }
    // Ready again: a flash.
    if (n.wasCooling && !cooling && look.readyGlow && !el.hidden) {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
    n.wasCooling = cooling;
  }
  reportArea();
}
setInterval(tick, 100);

a2.on("widget", (d) => {
  if (!d) return;
  look = { ...look, ...(d.look || {}) };
  slots = d.slots || [];
  build();
});
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
  tick();
});

// Only the icons take the mouse; clicks beside them go through to the game
// (meter 2.0.70 on, Linux).
let lastArea = "";
function reportArea() {
  if (typeof a2.widget.area !== "function") return;
  const rs = [...nodes.values()].filter((n) => !n.el.hidden).map((n) => n.el.getBoundingClientRect());
  let area = { x: 0, y: 0, width: 1, height: 1 };
  if (rs.length) {
    const x = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.left))));
    const y = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.top))));
    area = { x, y, width: Math.ceil(Math.max(...rs.map((r) => r.right)) - x), height: Math.ceil(Math.max(...rs.map((r) => r.bottom)) - y) };
  }
  const key = JSON.stringify(area);
  if (key === lastArea) return;
  lastArea = key;
  a2.widget.area(area).catch(() => {});
}

// A press becomes a drag once the pointer moves, so a double-click still
// reaches the page (as Event Timers' icons do).
const DRAG_PX = 4;
const DOUBLE_MS = 400;
let press = null;
let lastClick = 0;
grid.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || !e.target.closest(".slot")) return;
  e.preventDefault();
  press = { x: e.screenX, y: e.screenY };
});
document.addEventListener("mousemove", (e) => {
  if (!press) return;
  if (!(e.buttons & 1)) {
    press = null;
    return;
  }
  if (Math.abs(e.screenX - press.x) + Math.abs(e.screenY - press.y) >= DRAG_PX) {
    press = null;
    lastClick = 0;
    a2.widget.drag().catch(() => {});
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !press) return;
  press = null;
  const now = Date.now();
  if (now - lastClick <= DOUBLE_MS) {
    lastClick = 0;
    a2.widget.post({ open: true }).catch(() => {});
  } else {
    lastClick = now;
  }
});
document.addEventListener("contextmenu", (e) => e.preventDefault());

a2.ready();
