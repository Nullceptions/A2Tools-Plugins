# Event Timers

Countdowns to AION 2's recurring events and scheduled bosses, in your server's time, nearest first.

| Event | When (server time) |
|---|---|
| Shugo Festival | every hour at :00, in your faction's field |
| Dimensional Invasion | every hour at :30, in your faction's field |
| Spacetime Rift | every 3 hours from 02:00 (the portal stays open 10 minutes) |
| Watcher Kaira | every 3 hours from 01:00, Lower Reshanta |
| Artifact Siege | Monday, Thursday and Saturday at 21:00 |
| Executors Tamasa, Argo and Kaira | Monday, Thursday and Saturday at 21:30 |
| Guardian Lord Nahma | Friday and Sunday at 21:00 |
| Daily and weekly resets | 07:00 UTC; the weekly one on Wednesday |

Each row shows how long until it starts and the start in your own clock; a running event shows how long it has left (where the game's data says how long it runs). × hides an event; the hidden ones are listed below the others, and clicking one shows it again. Folded (the window's compact button), only the next three show.

## Server time

Each Global region's servers keep their own clock: NA East is New York time, NA West Los Angeles, Europe Berlin, South America São Paulo, Asia Seoul. The region comes from your character's server (the second digit of its number), and so does your faction (the first). Before you log in, or to see another region's times, pick it under **Server time**. Korean and Taiwanese servers share their numbers and run some events on other cycles, so they aren't covered yet.

## Where the times come from

The game's own tables: `EventSchedule` and `FieldEvent` for the field events, `PeriodSpawn` for the scheduled bosses and rift portals, `RiftData` for how long a portal stays open, and names in the game's own words in every language. Maps that aren't open yet (Eltnen, Morheim, Middle Reshanta) are left out, as in Pet Soul Tracker. To rebuild `schedule.js` after a game patch, extract the client's `AION2/Content/Data/Table` and `Data/Map` to JSON, then run:

```
python tools/event-timers/build.py --tables <Output>/AION2/Content/Data/Table --tw-l10n <TW Output>/AION2/Content/Data/Table/L10N
```

Field bosses that respawn a while after they're killed (most of the world map's named bosses) aren't on a schedule, so they aren't here yet.

## Permissions

- `events:character`: your server, for its time and your faction.
- `storage`: your region choice and hidden events, on this computer.
