# Cooldowns

Your skill cooldowns and buffs as icons you place anywhere over the game, in the spirit of NotMeter's Combat Assist.

- **Skills:** every skill of your class with a cooldown. Turn on the ones to show; with "Add skills as you use them" on, each one you use turns itself on. A dark sweep and the seconds left run over each icon while it cools down; it flashes when ready. Click a skill for its options: keep it showing when ready, a sound when ready, its name spoken when ready.
- **Buffs:** every buff you've had. Show any as its own icon (a green bar and its seconds); a buff from one of your skills shows on that skill's icon too. Options: a sound or its name spoken just before it ends.
- **Look:** one bar or skills and buffs apart, icon size, the way it grows, icons per line, opacity, seconds, the flash.
- **Alerts:** the sound, spoken names (your computer's voices), how long before a buff ends to warn.
- Settings are per character.

## Where the times come from

The game works cooldowns out itself, so nothing in its traffic says how long a skill's cooldown is when you use it. The plugin reads (all decoders in `manifest.json`):

| Opcode | What it is |
| --- | --- |
| `01 38` | You used a skill: its id (a variant of the skill; its cooldown group is the base, see `skills.js` `variants`). |
| `47 38` | Cooldowns: a list of (group, ms left). One entry when something changed a cooldown (0: it was reset); every group at once now and then. |
| `2A 38`, `2B 38`, `2C 38` | A buff on you added, changed, removed (`capture/abnormal.rs` in the meter has the layout). |

A skill starts at the game's base time (Skill table `NeedCoolTime`, shown with ≈). Whenever a full list arrives, the time since you used a skill plus the time it has left is its real cooldown, with your cooldown reduction in it (a Sorcerer's 60 s skills ran 27.8 s). The median of the last five is kept, per character. A measurement is dropped when the skill was reset meanwhile, or was used again without `01 38` (not every use sends it: the list then shows it ready, or with more left than it should have). Skills not yet measured scale by how far the measured ones are below base.

## Data

`skills.js` and `icons/` are built by `tools/cooldowns/build_skills.py` from the game's Skill and SkillAbnormal tables and the meter's skill and buff names:

```
python tools/cooldowns/build_skills.py --tables <extractor>/Output/AION2/Content/Data/Table
```

## Not yet

Party members' cooldowns, debuffs on your target, the boss's casts and presets you can share: the decoders only read your own character for now.
