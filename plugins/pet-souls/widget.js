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
bar.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || e.target.closest("button")) return;
  e.preventDefault();
  a2.widget.drag().catch(() => {});
});
$(".size").addEventListener("click", () => a2.widget.post({ size: true }).catch(() => {}));
$(".dock").addEventListener("click", () => a2.widget.post({ close: true }).catch(() => {}));

a2.ready();
// Ask for the scene: the window sends one as it changes, and at once on this.
a2.widget.post({ hello: true }).catch(() => {});
