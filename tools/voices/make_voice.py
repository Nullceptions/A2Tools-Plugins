"""The built-in voice of Event Timers and Cooldowns: every line each can say,
in English (phrases.js), made with Kokoro (https://huggingface.co/hexgrad/Kokoro-82M,
Apache 2.0) and written to plugins/<plugin>/kokoro.js as Opus clips, which
voices.js plays when the computer has no voices (Linux: the meter's web view
has no speech) or the player picks it.

Run it again when a plugin's names change (new events, bosses or skills),
then bump that plugin's version:

    pip install kokoro soundfile    # Python 3.10 to 3.12; soundfile 0.13+ writes Opus
    python tools/voices/make_voice.py event-timers cooldowns [--voice af_heart]

Clips already made for the same text, voice and bitrate are kept, so a run
after a data update only makes the new ones.
"""
import argparse
import base64
import io
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SR = 24000
LEVELS = {"cooldowns": 0.95}


def phrases(plugin):
    out = subprocess.run(["node", str(ROOT / "tools" / "voices" / "phrases.js"), plugin],
                         capture_output=True, text=True, encoding="utf-8", check=True).stdout
    return [line for line in out.splitlines() if line.strip()]


def existing(path, tag):
    """The clips in a kokoro.js made with the same voice and bitrate."""
    if not path.exists():
        return {}
    src = path.read_text(encoding="utf-8")
    if f"// voice: {tag}\n" not in src:
        return {}
    return json.loads(src[src.index("{"):src.rindex("}") + 1])


def trimmed(audio, np):
    """Without the silence before and after, but 40 ms of it."""
    loud = np.flatnonzero(np.abs(audio) > 0.01)
    if not len(loud):
        return audio
    pad = int(SR * 0.04)
    return audio[max(0, loud[0] - pad):loud[-1] + pad]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plugins", nargs="+")
    ap.add_argument("--voice", default="af_heart")
    # Opus' compression level, from about 265 kbps at 0 to 10 kbps at 1:
    # 0.94 is about 24 kbps; Cooldowns' 1,067 names get 0.95 (21 kbps) to
    # keep the plugin under the meter's 8 MB.
    ap.add_argument("--level", type=float)
    args = ap.parse_args()

    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    for plugin in args.plugins:
        level = args.level if args.level is not None else LEVELS.get(plugin, 0.94)
        tag = f"{args.voice} opus {level}"
        out = ROOT / "plugins" / plugin / "kokoro.js"
        texts = phrases(plugin)
        had = existing(out, tag)
        clips = {}
        made = 0
        for n, text in enumerate(texts, 1):
            if text in had:
                clips[text] = had[text]
                continue
            audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=args.voice)])
            ogg = io.BytesIO()
            sf.write(ogg, trimmed(audio, np), SR, format="OGG", subtype="OPUS", compression_level=level)
            clips[text] = base64.b64encode(ogg.getvalue()).decode()
            made += 1
            print(f"{plugin} {n}/{len(texts)} {len(ogg.getvalue()):>6} B  {text}", flush=True)
        out.write_text(
            "// Built by tools/voices/make_voice.py: every line this plugin's built-in voice\n"
            "// can say, in English, made with Kokoro (the model and its voices are\n"
            "// Apache 2.0), as Opus clips; voices.js plays them. Don't edit by hand.\n"
            f"// voice: {tag}\n"
            "window.KOKORO_CLIPS = " + json.dumps(clips, ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8")
        print(f"{out}: {out.stat().st_size} B, {len(clips)} clips ({made} new)")


if __name__ == "__main__":
    main()
