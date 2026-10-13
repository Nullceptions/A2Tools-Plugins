# Writing a plugin

## Try it locally

1. Make a folder under `plugins/` named after your plugin's id (lowercase letters, digits, `-`).
2. In the meter, open **Settings → Plugins** and turn on **Plugin developer mode**.
3. Choose **Load plugin folder…** and pick your folder, then select **Open**.
4. After you edit your files, select **Check for updates**. The meter reads the folder again and reloads the plugin's window.

Developer-mode plugins carry an "Unreviewed plugin" badge.

## The folder

```
plugins/my-plugin/
  manifest.json   id, name, version, apiVersion, author, description, permissions, decoders, ui
  index.html      the page, loaded in the plugin's window
  *.js *.css      its scripts and styles (no inline scripts: script-src 'self')
  *.json *.png …  data and images
  README.md       for reviewers and players (not shipped)
```

Allowed file types: `.html .js .css .json .png .jpg .jpeg .webp .svg .gif .md .txt`. A plugin can be at most 8 MB.

`manifest.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "apiVersion": 1,
  "author": "Your name",
  "description": "One sentence: what it shows the player.",
  "permissions": ["storage"],
  "decoders": [],
  "ui": { "panel": { "width": 360, "height": 480 } }
}
```

## The API

Load `/_sdk/a2.js` before your own scripts. It provides `a2`:

```js
a2.on("decoded:<name>", (data) => …)  // your decoder read a packet       (decoder:<name>)
a2.on("character", (c) => …)          // name, serverId, class, level     (events:character)
a2.on("language", (code) => …)        // "en", "ko", "zh-Hans", … at start and on change
a2.on("compact", (on) => …)           // the window's fold button: show only the essentials
await a2.storage.get("key")           // your saved JSON, or null           (storage)
await a2.storage.set("key", value)
a2.notify("Text")                     // a short message in your window     (notify)
await a2.window.show() / hide()       // your window, without taking focus  (window, API 2)
a2.ready()                            // once your handlers are set: queued events arrive then
```

Keep the page background transparent. The window paints the panel at the opacity the player picks.

## Decoders

A decoder turns one game packet (by its two-byte opcode) into numbers. It reads only what it names, and only from the player's own game data.

```json
{ "name": "soul-gained", "opcode": "0D 90",
  "fields": [ { "type": "skip:1" }, { "name": "pet", "type": "u32" }, { "name": "amount", "type": "u32" } ] }
```

Field types: `u8 u16 u32 u64 i32 varint`, `skip:N`, and `list` (with a `count` of `u8 u16 u32 varint` and its own `fields`). Lists can nest two deep, and a decoder can read at most 32 fields. Each decoder needs the permission `decoder:<name>`.

`"self": "<field>"` (plugin API 2) names a number field that holds an entity id: the meter passes the event on only when that entity is the player's own character. Use it to tell "I did this" without ever seeing anyone else.

With `events:character`, a plugin's events reach it half a second after they are read, stamped with the character: at login the game sends some data (the pet list) just before the record saying who is playing. `"immediate": true` on a decoder skips that wait, for records that never come at login, such as a soul picked up; it never overtakes an earlier event of the plugin that is still waiting. Meters up to 2.0.63 ignore it and hold the event as before, so it needs no new `apiVersion`.

## Plugin API versions

- `"apiVersion": 1` runs on meter 2.0.60 and later.
- `"apiVersion": 2` adds a decoder's `"self"` field and the `window` permission, and needs meter 2.0.62. Older meters say the plugin needs a newer meter rather than run it.

## Submitting

Open a pull request. Before it's merged, review checks that:

- the permissions match what the plugin does;
- the decoders read only what the description says;
- nothing tries to leave the sandbox (other frames, the meter, the network);
- the player's data stays on their computer.

Before opening it, run `python tools/build_catalog.py`. It runs the same checks as CI.
