// A pinned timer's icon (pins.js sends it what to show every second). It
// follows the pointer when dragged, unless the pins are locked; a
// double-click opens the plugin's window.
const pin = document.querySelector(".pin");
const glyph = document.querySelector(".glyph");
const time = document.querySelector(".time");
const nameEl = document.querySelector(".name");
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
  glyph.textContent = initials(d.name);
  time.textContent = d.countdown || "";
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
document.addEventListener("dblclick", () => {
  if (!locked) a2.widget.post({ open: true }).catch(() => {});
});

a2.ready();
