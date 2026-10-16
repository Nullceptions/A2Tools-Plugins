// A pinned timer's icon (pins.js sends it what to show every second). It
// follows the pointer when dragged, unless the pins are locked; a
// double-click opens the plugin's window.
const pin = document.querySelector(".pin");
const glyph = document.querySelector(".glyph");
const art = document.querySelector(".art");
const time = document.querySelector(".time");
const nameEl = document.querySelector(".name");
const sub = document.querySelector(".sub");
const badge = document.querySelector(".badge");
let locked = false;

// Two letters for the badge: the first of each of the first two words, or the
// first two of one word ("Shugo" is "SH", "Kaira the Watcher" is "KT").
const initials = (name) => {
  const words = String(name || "").split(/[\s·:,-]+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? [...words[0]][0] + [...words[words.length - 1]][0] : [...words[0]].slice(0, 2).join("");
  return letters.toUpperCase();
};

a2.on("widget", (d) => {
  if (!d) return;
  // The game's icon when there is one, else the initials.
  const src = d.icon ? `icons/${d.icon}.png` : "";
  if (art.getAttribute("src") !== src) {
    if (src) art.setAttribute("src", src);
    else art.removeAttribute("src");
  }
  art.hidden = !src;
  glyph.hidden = !!src;
  glyph.textContent = initials(d.name);
  time.textContent = d.countdown || "";
  sub.textContent = d.sub || "";
  // A field boss's HP: the ring drains from the top as it falls.
  const hasHp = typeof d.hp === "number";
  badge.classList.toggle("hasHp", hasHp);
  const hpColor = hasHp ? (d.hp > 50 ? "#5fe08a" : d.hp > 20 ? "#ffd54a" : "#ff5a4f") : "";
  if (hasHp) {
    badge.style.setProperty("--hp", `${d.hp}%`);
    badge.style.setProperty("--hp-color", hpColor);
  }
  // The HP in the ring's colour; "Enter" keeps its own.
  sub.style.color = hpColor;
  nameEl.textContent = d.showName ? d.name : "";
  pin.className = `pin ${d.kind || "event"}${d.running ? " running" : ""}${d.due ? " due" : ""} ${d.effect || "shake"}`;
  document.title = d.name || "Event Timers";
});
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
});

document.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked) return;
  e.preventDefault();
  a2.widget.drag().catch(() => {});
});
// A right-click stops its alert's sound (unlocked: a locked icon lets clicks
// through to the game).
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  a2.widget.post({ mute: true }).catch(() => {});
});
document.addEventListener("dblclick", () => {
  if (!locked) a2.widget.post({ open: true }).catch(() => {});
});

a2.ready();
