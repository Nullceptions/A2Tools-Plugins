// The checklist's rules, without the page: when each list resets.
// plugin.js uses them; a test can load this file alone.
(() => {
  const DAY = 86_400_000;

  // When the current period began and when it ends (ms). Daily resets come at
  // `minutes` after midnight UTC; weekly ones at that time on `weekday`
  // (0 = Sunday). The game's tables: 07:00 UTC, weekly on Wednesday.
  function period(kind, now, { minutes = 420, weekday = 3 } = {}) {
    const d = new Date(now);
    let start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + minutes * 60_000;
    if (start > now) start -= DAY;
    if (kind === "weekly") {
      while (new Date(start).getUTCDay() !== weekday) start -= DAY;
      return { start, end: start + 7 * DAY };
    }
    return { start, end: start + DAY };
  }

  globalThis.ChecklistLogic = { period };
})();
