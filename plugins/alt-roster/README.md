# Roster / Content Overview

Every character you play in one window, kept between sessions: class,
level, server, combat power, gear score and Odyle energy. Leave it open, or
move it to a second monitor: it never hides by itself.

- **Basic energy refills while you are away.** The plugin estimates +15
  every 3 hours (on 01:00, 04:00, 07:00 … UTC) up to the cap: one refill was
  seen at 16:00 UTC, the rest of the rule is from another app, not checked.
  Each character's energy is shown as it likely is now: `≈` marks an
  estimate, the striped part of the bar is what refills added since the game
  last said. Logging in to the character corrects it.
- **Full in**: when each character's basic energy reaches the cap. A
  character already full is listed at the top: each refill from then on is
  lost until some is spent.
- **The cap** is 560, or 840 with a membership. A new character starts at
  560 and switches to 840 once more than 560 is seen. Click a character's
  cap to switch it, e.g. when a membership runs out.
- At the top: the next refill, and the daily (07:00 UTC) and weekly
  (Wednesday 07:00 UTC) resets, in your own time on hover.
- Sort by name, combat power, gear score, energy, full soonest or last
  played; search by name or server. × (on hover, then click again to
  confirm) removes a character; it comes back when you play it. A character
  moved to another server shows up as a new one: remove the old row.
- The fold button leaves only names, energy and Full in.
- **Content** tab: Nightmare and Ascension Trial left per character, Shugo
  Festival, Invasion and Daily Dungeon per server, as the game last said,
  with the extra from recharge items (`+N`). Daily Duty shows the quests
  completed today (n / 5; the game's own n/5 counts the taken ones, done or
  not: those are in the tooltip), added up over your characters on the
  server, back to 0 at the daily reset.
- **Recharges while you are away are estimates** (`≈`, striped), up to the
  cap. From the game's tooltips: Nightmare +2 a day (cap 14), Shugo +3 a day
  (cap 21), Ascension Trial +3 a week (cap 3), Daily Dungeon 14 a week.
  Not from the game, so less sure: Invasion cap 7 at +1 a day, Daily Duty 5
  a day shared by the server's characters (from another app, and how the
  game behaved), and that Daily Dungeon is the game's entry 101 (the only
  14 + 3 in the list).

## What it reads

No decoders. Only the meter's `character` event (`events:character`): name,
server, class and level, and from meter 2.0.78 on combat power, gear score
and Odyle energy (basic and charged). On older meters the roster shows the
characters without those. The Content counts (`contentCounts`) come from
the same event from meter 2.0.78 on; without them the Content tab shows
`?`.

Server names: `servers.js`, from the meter's own list.

In the meter's ten languages (`i18n.js`), following its language setting.
Content and class names are the game's own where the meter's tables have
them; "Daily Duty" and "Daily Dungeon" are translated and may differ from
the game's wording.
