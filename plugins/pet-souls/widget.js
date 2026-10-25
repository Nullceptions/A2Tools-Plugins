// Pet Soul Tracker's map, popped out: a widget drawing the scene the window
// sends it (plugin.js), the same map as in the window (minimap.js).
const $ = (s) => document.querySelector(s);
const bar = $(".bar");
const where = $(".where");
let zoomFromWindow = false;
const map = new PetMiniMap.MiniMap(
  { canvas: $(".minimap"), zoomIn: $(".zoomIn"), zoomOut: $(".zoomOut"), follow: $(".follow"), note: $(".mapNote") },
  { onZoom: (zoom) => a2.widget.post({ zoom }).catch(() => {}) },
);

a2.on("widget", (scene) => {
  if (!scene || typeof scene !== "object") return;
  // Its zoom is kept by the window: taken once, then this widget's own.
  if (!zoomFromWindow && scene.zoom != null) {
    zoomFromWindow = true;
    map.setZoom(scene.zoom);
  }
  $(".title").textContent = scene.title || "Around you";
  where.textContent = scene.where || "";
  where.title = scene.whereTitle || "";
  where.className = `where ${scene.whereClass || ""}`.trim();
  $(".count").textContent = scene.count || "";
  map.set(scene);
});

// The bar moves the widget (unlocked); its buttons don't.
let locked = false;
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
});
// Heard on the page and placed by where the press is, not by its target: a
// pointer the map still held would send the press there, and the widget
// could no longer be moved until it was opened again.
document.addEventListener("pointerdown", (e) => {
  // Any capture left over goes first (the map takes a new one for its own drag).
  for (const el of document.querySelectorAll("canvas")) if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  if (e.button !== 0 || locked) return;
  const r = bar.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
  if (document.elementsFromPoint(e.clientX, e.clientY).some((el) => el.closest?.("button"))) return;
  e.preventDefault();
  a2.widget.drag().catch(() => {});
}, true);
$(".size").addEventListener("click", () => a2.widget.post({ size: true }).catch(() => {}));
$(".dock").addEventListener("click", () => a2.widget.post({ close: true }).catch(() => {}));

a2.ready();
// Ask for the scene: the window sends one as it changes, and at once on this.
a2.widget.post({ hello: true }).catch(() => {});
