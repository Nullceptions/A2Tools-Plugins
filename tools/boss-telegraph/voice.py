"""Enhanced Boss Telegraph's built-in voice: every line it can speak, in English,
made with Kokoro (https://huggingface.co/hexgrad/Kokoro-82M, Apache 2.0) and
written to plugins/boss-telegraph/voice.js as Opus clips.

For computers with no voices of their own (Linux: the meter's web view has no
speech). Run it again after build.py and bump the version:

    pip install kokoro soundfile    # Python 3.10 to 3.12
    python tools/boss-telegraph/voice.py [--voice af_heart]

Needs ffmpeg with libopus.
"""
import argparse
import base64
import io
import json
import subprocess
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[2] / "plugins" / "boss-telegraph"
# Said by the page itself (i18n.js): the voice and volume preview.
EXTRA = ["Enhanced Boss Telegraph"]


def spoken(data):
    """The English of every text a call can say (logic.js: words, startPhase, endPhase)."""
    ids = {data["safe"]}
    for c in data["calls"]:
        for k in ("line", "act"):
            if c.get(k) is not None:
                ids.add(c[k])
        if c["t"] == "abnormal" and c.get("n") is not None:
            ids.add(c["n"])
        for k in ("label", "n"):
            if (c.get("phase") or {}).get(k) is not None:
                ids.add(c["phase"][k])
    return sorted({data["texts"][i]["en"] for i in ids if data["texts"][i].get("en")} | set(EXTRA))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--bitrate", default="24k")
    args = ap.parse_args()

    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    src = (PLUGIN / "bosses.js").read_text(encoding="utf-8")
    data = json.loads(src[src.index("{"):src.rindex("}") + 1])
    texts = spoken(data)
    pipe = KPipeline(lang_code="a")
    clips = {}
    for n, text in enumerate(texts, 1):
        audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=args.voice)])
        wav = io.BytesIO()
        sf.write(wav, audio, 24000, format="WAV", subtype="PCM_16")
        ogg = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-i", "pipe:0", "-c:a", "libopus", "-b:a", args.bitrate,
             "-application", "voip", "-f", "ogg", "pipe:1"],
            input=wav.getvalue(), capture_output=True, check=True).stdout
        clips[text] = base64.b64encode(ogg).decode()
        print(f"{n}/{len(texts)} {len(ogg):>6} B  {text}")

    out = PLUGIN / "voice.js"
    out.write_text(
        "// Built by tools/boss-telegraph/voice.py: every line the plugin can say, in English,\n"
        f"// made with Kokoro (voice {args.voice}; the model and its voices are Apache 2.0),\n"
        "// as Opus clips. The built-in voice, for computers with none of their own.\n"
        "// Don't edit by hand: run it again after build.py.\n"
        "window.BOSS_VOICE = " + json.dumps(clips, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(f"{out}: {out.stat().st_size} B, {len(clips)} clips")


if __name__ == "__main__":
    main()
