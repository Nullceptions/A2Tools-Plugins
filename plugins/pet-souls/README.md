# Pet Soul Tracker

Shows how many souls each of your pets still needs to reach level 3 (Special pets are left out: they come at their highest level). Filter by genus and level, or search by name: the bar shows the current level's progress, and **To Lv 3** the total still to collect.

It reads three things the game sends: every pet's level and soul points when you log in, each soul as you pick it up, and each level a pet reaches. Counts are kept per character, so the list survives restarts; logging in again resyncs it from the game.

Souls per level: 5 (level 0 → 1, inferred), 25 (1 → 2) and 75 (2 → 3).

Pets show by their in-game names, in the meter's language (all ten; `pets.js`, built from the game's `String_str_veh_*` texts). Double-click a name to give it your own; clear it to go back. Search filters by name (shown or English) or id, and each column header sorts the list; pressing it again reverses the order.

## Permissions

- `decoder:pet-list`, `decoder:soul-gained`, `decoder:level-up`: read your own pets' levels and soul gains.
- `events:character`: keep a separate list per character.
- `storage`: save the counts, your pet names and the sort order on this computer.

## Try it (developer mode)

Settings → Plugins: turn on **Plugin developer mode**, choose **Load plugin folder…**, pick this folder, then **Open**. Log in (or relog) to sync. After editing the files, **Check for updates** reloads them.
